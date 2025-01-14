import ELK, {ElkEdgeSection, ElkExtendedEdge, ElkNode} from 'elkjs'
import {ComponentType, DefaultPluginType, ComponentLinkType} from "./ExternalTypes";
import {ELKParams, NodeData, NodeMap} from "./InternalTypes";

const elk = new ELK()


export class AutoLayout {
    plugin: ()=>DefaultPluginType;
    renderedLayouts: ElkNode[];

    constructor(plugin: ()=>DefaultPluginType) {
        this.plugin = plugin;
        this.renderedLayouts = [];
    }

    private saveEdgesForDrawing(layout: ElkNode) {
        /*
        On rend le résultat de ELK accessible aux fonctions de dessin des arêtes.
         */

        // monkey patching
        if (this.plugin().data.__elkEdges === undefined)
            this.plugin().data.__elkEdges = new Map<string, ElkEdgeSection>();

        if (this.plugin().data.__elkNodesEdgesMap === undefined)
            this.plugin().data.__elkNodesEdgesMap = new Map<string, string[]>();

        const map = this.plugin().data.__elkEdges
        const nodesEdgesMap = this.plugin().data.__elkNodesEdgesMap;

        for (const edge of layout.edges) {
            const source = edge.sources[0];
            const target = edge.targets[0];
            const edgeName = source + '__' + target;
            map.set(edgeName, edge.sections[0]);

            if (!nodesEdgesMap.has(source)) nodesEdgesMap.set(source, []);
            if (!nodesEdgesMap.has(target)) nodesEdgesMap.set(target, []);
            nodesEdgesMap.get(source).push(edgeName);
            nodesEdgesMap.get(target).push(edgeName);
        }
    }

    private getComponentsAndLinks():{components:ComponentType[],links:ComponentLinkType[]} {
        return {
            components: this.plugin().data.components,
            links: this.plugin().data.getLinks()
        }
    }

    private getNodes(components: ComponentType[],ignoreIgnored=false):{
        nodes_map: Map<string, NodeData>,
        nodes : NodeData[],
        nodes_ignored : Set<string> // nodes id
    }
    {

        const nodes_map: NodeMap = new Map<string, NodeData>();
        const nodes: NodeData[] = Array.from(nodes_map.values())
        const nodes_ignored = new Set<string>();

        for (const c of components) {
            if(!ignoreIgnored&&c.__ignored)
                nodes_ignored.add(c.id);
            const e: NodeData = {raw: c, children: [], parent: null, depth: 0};
            nodes_map.set(c.id, e);
            nodes.push(e);
        }


        /* Pour chaque noeud, on calcule les parents et les enfants */
        function findParentId(node: NodeData): string {
            for (const attr of node.raw.attributes) {
                if (["workflow", "network", "workflow_id", "job_id"].includes(attr.name))
                    return attr.value as string;
            }
            return null;
        }

        for (const node of nodes) {
            node.parent = nodes_map.get(findParentId(node));
            if (node.parent) node.parent.children.push(node);
        }

        /* on définit une racine */
        const root:NodeData = {raw: null, children: [], parent: null, depth: 0};
        for (const node of nodes) {
            if (!node.parent) {
                node.parent = root
                root.children.push(node);
            }
        }

        /* puis la profondeur */
        function computeDepth(node: NodeData): number {
            if (!node.parent)
                return 0;
            return computeDepth(node.parent) + 1;
        }

        for (const node of nodes) {
            node.depth = computeDepth(node);
        }

        return {nodes_map, nodes, nodes_ignored};
    }

private getParentsByDepth(nodes, ignoreIgnored=false): NodeData[]
{
    /* rendu hiérarchique : liste des noeuds
* On calcule la liste des parents de noeuds (ce sont des noeuds également)
* par niveau décroissant de profondeur, afin de pouvoir faire le rendu d'abord
*  en profondeur et remonter.
* */

    return Array.from(
        new Set<NodeData>(nodes
            .map(c=>c.parent)
            .filter(c=>ignoreIgnored||!c.raw?.__ignored)
        ))
        .sort((a,b)=>b.depth-a.depth);
}

    async generateLayouts(params: ELKParams) {
       const {components, links} = this.getComponentsAndLinks();
        console.log("ELK parameters", params)
        console.log("Noeuds et liens", {components, links})

        const {nodes, nodes_map,nodes_ignored} = this.getNodes(components);


        // TODO : j'ai *sans-doute* cassé la structure hiérarchique qui fait le rendu en profondeur d'abord
        // en enlevant l'affichage effectif entre les rendus à différents niveaux ...
        // pas trop génant pour la démo Github Actions, un seul des layout compte vraiment (le workflow)

        // Pour chaque noeud parent, on fait un layout de ses enfants.
        this.renderedLayouts = await Promise.all(
            this.getParentsByDepth(nodes)
            .map( (node) => this.generateNodeLayout(params,node,nodes_ignored, nodes_map, links) )
        )

        return this.renderedLayouts;
    }

    /*
    Génère le layout pour les enfants d'un noeud donné en argument
     */
    private async generateNodeLayout(params,node,nodes_ignored, nodes_map, links, ignoreIgnored=false){
        const layoutOptions = {
            'elk.algorithm': 'elk.layered', 'spacing.baseValue': '50', /*'spacing.nodeNode': '100',*/
            'separateConnectedComponents': params.separateConnectedComponents ? 'true' : 'false', ...(params.interactive ? {         /* c'est ici qu'on règle le niveau d'interactivité ie. d' "incrémentalité" */
                "elk.layered.cycleBreaking.strategy": params.cycleBreaking,
                "elk.layered.layering.strategy": params.layering,
                'elk.layered.crossingMinimization.strategy': params.crossingMinimization,
                'elk.layered.nodePlacement.strategy': params.nodePlacement,
                'elk.layered.interactiveReferencePoint': params.interactiveReferencePoint,
            } : {}), 'elk.debugMode': 'true',

            'elk.direction': params.direction
        };
        const graph: ElkNode = {
            id: node.raw?node.raw.id:'root', layoutOptions, children: [], edges: []
        }
        graph.children = node.children
            .filter(c=>ignoreIgnored||!c.raw.__ignored) // ignore les noeuds... ignorés
            .map(c => ({
                id: c.raw.id,
                width: c.raw.drawOption.width,
                height: c.raw.drawOption.height,
                x: c.raw.drawOption.x,
                y: c.raw.drawOption.y,
                layoutOptions: {...layoutOptions},
            }))


        const localLinks = this.getLinksForChildren(nodes_ignored, nodes_map, links, node);
        graph.edges = localLinks.map(link => ({
            id: link[0] + "__" + link[1], sources: [link[0]], targets: [link[1]]
        }))

        return await elk.layout(graph);
    }


    private climbToDepth(initialNode: NodeData, depth: number): NodeData | null {

        let node = initialNode;
        if (node.depth < depth) return null;

        while (node.depth > depth) node = node.parent;

        //console.log("climb",initialNode.raw?.id,initialNode.depth,node.raw?.id,node.depth);
        return node;
    }

    private getLinksForChildren(nodes_ignored: Set<string>, nodes_map: NodeMap, all_links: ComponentLinkType[], parentNode: NodeData) {
        const kept_ids = new Set(parentNode.children.map(c => c.raw?.id));

        const depth = parentNode.depth + 1;
        const links = all_links
            .map((link) => {

                if (nodes_ignored.has(link.source) || nodes_ignored.has(link.target)) {
                    // noeud ignoré
                    return null;
                }

                const source = nodes_map.get(link.source as unknown as string);
                const target = nodes_map.get(link.target as unknown as string);


                if (source == undefined || target == undefined) {
                    console.error({
                        error: "source or target undefined", names: [link.source, link.target], link, source, target
                    })
                    return null;
                }
                const sourceDepth = this.climbToDepth(source, depth);
                const targetDepth = this.climbToDepth(target, depth);
                return [sourceDepth, targetDepth];
            })
            .filter(t => t) // discard null
            .filter(t => t[0] != t[1])
            .filter(t => t[0] && t[1]) // not null
            .filter(link => kept_ids.has(link[0].raw.id) && kept_ids.has(link[1].raw.id))

        return links.map(t => [t[0].raw.id, t[1].raw.id]);
    }

    drawLayouts(layouts: ElkNode[]){


        for(const layout of layouts)
        {
            this.saveEdgesForDrawing(layout);
            this.drawLayout(layout);
        }

    }
    private drawLayout(layout: ElkNode) {

        const nodes: Map<string, { x: number, y: number }> = new Map(layout.children.map(e => [e.id, {
            x: e.x, y: e.y
        }]));
        const scale = 1;
        for (let i in this.plugin().data.components) {
            let comp = this.plugin().data.components[i];
            if (nodes.has(comp.id)) {
                const coord = nodes.get(comp.id)

                comp.drawOption.x = coord.x * scale;

                comp.drawOption.y = coord.y * scale;
            }
        }
    }


    async replacementAuto(params,N:number = 5) {
        function one_layout_distance(orig: ElkNode, candidate: ElkNode) {

            const origNodeMap = new Map<string, ElkNode>();
            for (const node of orig.children) {
                origNodeMap.set(node.id, node);
            }

            const origEdgeMap = new Map<string, ElkExtendedEdge>();
            for (const edge of orig.edges) {
                origEdgeMap.set(edge.id, edge);
            }

            // distance des noeuds entre eux
            let score1 = 0;
            let score1_i = 0
            for (const e of candidate.edges) {
                if(origEdgeMap.has(e.id))
                {
                    const {s1,e1} = e.sections.map(({startPoint,endPoint})=>({s1:startPoint,e1:endPoint}))[0];
                    const dCandid2 = Math.pow(s1.x - e1.x, 2) + Math.pow(s1.y - e1.y, 2);

                    const {s2,e2} = origEdgeMap.get(e.id).sections.map(({startPoint,endPoint})=>({s2:startPoint,e2:endPoint}))[0];
                    const dOrig2=  Math.pow(s2.x - e2.x, 2) + Math.pow(s2.y - e2.y, 2);

                    const dDiff = Math.abs(dCandid2 - dOrig2);
                    score1 += dDiff;
                    score1_i++;
                }
            }
            if(score1_i !=0 )
                score1 /= score1_i;
            /*
            for (const n1 of candidate.children) {
                for (const n2 of candidate.children) {
                    if (n1 != n2 && origNodeMap.has(n1.id) && origNodeMap.has(n2.id)) {
                        const dCandid2 = Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2);

                        const m1 = origNodeMap.get(n1.id);
                        const m2 = origNodeMap.get(n2.id);
                        const dOrig2 = Math.pow(m1.x - m2.x, 2) + Math.pow(m1.y - m2.y, 2);
                        score1 += Math.abs(dOrig2 - dCandid2);
                    }
                }
            }
            score1 /= Math.pow(orig.children.length, 2)*/

            // distance des connexions des noeuds nouvellement placés
            let score2 = 0;
            let score2_i = 0
            const newNodes = new Set(candidate.children.filter(n=>!origNodeMap.has(n.id)).map(n=>n.id))
            for (const e of candidate.edges) {
              const source = e.sources[0];
              const target = e.targets[0];
              if(newNodes.has(source) || newNodes.has(target))
              {
                  const {startPoint,endPoint} = e.sections[0];
                  const d = Math.pow(startPoint.x - endPoint.x, 2) + Math.pow(startPoint.y - endPoint.y, 2)
                  score2 += d;
                  score2_i++;
              }
            }
            if(score2_i !=0 )
                score2 /= score2_i;

            const score = score1 + score2;

            const info = {
                score:Math.round(score),
                score1:Math.round(score1),
                score2:Math.round(score2),
                orig,
                candidate};

            return {score,info};
        }

        function layoutsDistance(orig:ElkNode[], candidate:ElkNode[]) {
            // /!\ fonction distance faite uniquement pour l'exemple Github Actions
            let L1:ElkNode = orig.filter(e=>e.id=='workflow_1')[0];
            let L2 : ElkNode= candidate.filter(e=>e.id=='workflow_1')[0];
            return one_layout_distance(L1,L2);
        }

        const orig:ElkNode[] = await this.generateLayouts(params,)
        let bestScore: number = +Infinity; // on veut minimiser
        let bestLayouts = undefined;


        // keep best
        for (let i = 0; i < N; ++i) {
            const candidate:ElkNode[] = await this.generateLayoutsWithRandomIgnored(params);
            const {score,info} = layoutsDistance(orig, candidate);
            let better = false;
            if (score < bestScore) {
                better = true;
                bestScore = score;
                bestLayouts = candidate;
            }
            if(better)
            console.log(`${better?'BEST ':''}i=${i} score=${info.score}`,info);

        }

        return [bestLayouts,bestScore];
    }

    /* Génère un layout en plaçant avec des coordonnées aléatoires uniformes les noeuds marqués "ignorés" */
    private async generateLayoutsWithRandomIgnored(params: ELKParams) {

        const {components, links} = this.getComponentsAndLinks();

        const {nodes, nodes_map,nodes_ignored}=this.getNodes(components, true);


        // Pour chaque noeud parent, on fait un layout de ses enfants.
        this.renderedLayouts = [];

        for(const node of this.getParentsByDepth(nodes, true)) {

            let minX=+Infinity,minY=+Infinity, maxX = -Infinity, maxY = -Infinity;
            for(const e of node.children){
                const {x,y,height,width} = e.raw.drawOption;
                minX = Math.min(minX,x);
                minY = Math.min(minY,y);
                maxX = Math.max(maxX,x+width);
                maxY = Math.max(maxY,y+height);
            }

            for(const e of node.children){
                if(!e.raw.__ignored)
                    continue;
               e.raw.drawOption.x = Math.random()*(maxX-minX)+minX;
               e.raw.drawOption.y = Math.random()*(maxY-minY)+minY;
            }


            const r = await this.generateNodeLayout(params,node,nodes_ignored, nodes_map, links, true);
            this.renderedLayouts.push(r);
        }
        return this.renderedLayouts;
    }
/*
WIP : enlever les overlap pour les éléments nouvellement placés en éloignant les autres
 TODO : renommer les variables, c'est n'importe quoi là
 */
    async overlapForceAlgo() {
        const {components, links} = this.getComponentsAndLinks();
        const {nodes_map,nodes_ignored} = this.getNodes(components);


        // détecter les overlap
        function getOverlapNodes(target, nodes)
        {
            const {x,y,width,height} = target.raw.drawOption;
            const L = [];
            for(const node of nodes)
            {
                if(node===target) // ce même noeud
                    continue;

                const x2 = node.raw.drawOption.x;
                const y2 = node.raw.drawOption.y;
                const w2 = node.raw.drawOption.width;
                const h2 = node.raw.drawOption.height;

                if( ( (x<=x2 && x2 <= x+width)
                        || ( x2 <= x && x <= x2+w2) )

                    && ( (y <= y2 && y2 <= y+height)
                        || (y2 <= y && y <= y2+h2) ) )
                    L.push(node);

            }
            return L;
        }

        function eloigner(node,from, step_size:number)
        {
            const x2 = node.raw.drawOption.x;
            const y2 = node.raw.drawOption.y;
            const w2 = node.raw.drawOption.width;
            const h2 = node.raw.drawOption.height;

            const {x,y,width,height} = from.raw.drawOption;

            const dx = (x2+w2/2)-(x+width/2);
            const dy = (y2+h2/2)-(y+height/2);
            node.raw.drawOption.x += dx*step_size;
            node.raw.drawOption.y += dy*step_size;
        }

        function traiter(noeuds)
        {
            for(const ignored_id of noeuds)
            {
                const ignored = nodes_map.get(ignored_id);
                // noeud dans lequel faire le rendu
                const parent = ignored.parent;

                // traitement
                let overlap;
                do
                {
                    overlap = getOverlapNodes(ignored,parent.children);
                    const step_size = 0.1;
                    for(const node of overlap)
                        eloigner(node,ignored, step_size);
                    overlap = getOverlapNodes(ignored,parent.children);
                }
                while(overlap.length != 0)

            }
        }

        traiter(Array.from(nodes_ignored));

    }


    // idem en récursif
    // TODO : refaire un peu plus rigoureusement ...
    async forceAlgoToutNoeud() {


        const {components, links} = this.getComponentsAndLinks();
        const {nodes_map,nodes_ignored} = this.getNodes(components);


        // détecter les overlap
        function getOverlapNodes(target: NodeData, nodes: NodeData[])
        {
            const {x,y,width,height} = target.raw.drawOption;
            const L = [];
            for(const node of nodes)
            {
                if(node===target) // ce même noeud
                    continue;

                const x2 = node.raw.drawOption.x;
                const y2 = node.raw.drawOption.y;
                const w2 = node.raw.drawOption.width;
                const h2 = node.raw.drawOption.height;

                if( ( (x<=x2 && x2 <= x+width)
                        || ( x2 <= x && x <= x2+w2) )

                    && ( (y <= y2 && y2 <= y+height)
                        || (y2 <= y && y <= y2+h2) ) )
                    L.push(node);

            }
            return L;
        }

        function eloigner(node:NodeData, from:NodeData, step_size:number)
        {
            const x2 = node.raw.drawOption.x;
            const y2 = node.raw.drawOption.y;
            const w2 = node.raw.drawOption.width;
            const h2 = node.raw.drawOption.height;

            const {x,y,width,height} = from.raw.drawOption;

            const dx = (x2+w2/2)-(x+width/2);
            const dy = (y2+h2/2)-(y+height/2);
            node.raw.drawOption.x += dx*step_size;
            node.raw.drawOption.y += dy*step_size;
        }

        function traiter(noeuds: string[], max_depth=3, depth=1)
        {
            let noeuds_rencontres = new Set<NodeData>();

            for(const ignored_id of noeuds)
            {
                const ignored:NodeData = nodes_map.get(ignored_id);
                // noeud dans lequel faire le rendu
                const parent = ignored.parent;

                // traitement
                let overlap:NodeData[];
                do
                {
                    overlap = getOverlapNodes(ignored,parent.children);
                    for(const x of overlap)
                        noeuds_rencontres.add(x);

                    const step_size = 0.1;
                    for(const node of overlap)
                        eloigner(node,ignored, step_size);
                    overlap = getOverlapNodes(ignored,parent.children);
                }
                while(overlap.length != 0)
            }

            if(max_depth > depth)
                traiter(Array.from(noeuds_rencontres).map(x=>x.raw.id),max_depth,depth+1);


        }

        traiter(Array.from(nodes_ignored));


    }
}
