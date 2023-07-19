import ELK, {ElkEdgeSection, ElkExtendedEdge, ElkNode} from 'elkjs'
import {Component, ComponentLink, DefaultPlugin} from "leto-modelizer-plugin-core";

/*
Required packages:

npm i elkjs web-worker d3

 */

interface NodeData {
    parent: NodeData
    raw: Component | null
    children: NodeData[]
    depth: number
}

type NodeMap = Map<string, NodeData>;


const elk = new ELK()
export let renderedLayouts = [];

interface ELKParams
{
    separateConnectedComponents: boolean;
    interactive: boolean
    "cycleBreaking": string//"INTERACTIVE",
    "layering": string//"INTERACTIVE",
    'crossingMinimization': string//'INTERACTIVE',
    'nodePlacement': string//'INTERACTIVE',
    'interactiveReferencePoint': string//'TOP_LEFT',
    'direction': string//'UNDEFINED'
}

function save_edges_for_drawing(plugin: DefaultPlugin,layout:ElkNode)
{
    /*
    On rend le résultat de ELK accessible aux fonctions de dessin des arêtes.
     */

    // monkey patching

    if(plugin.data.__elkEdges === undefined)
        plugin.data.__elkEdges = new Map<string, ElkEdgeSection>();

    if(plugin.data.__elkNodesEdgesMap === undefined)
        plugin.data.__elkNodesEdgesMap = new Map<string, string[]>();

    const map = plugin.data.__elkEdges
    const nodesEdgesMap = plugin.data.__elkNodesEdgesMap;

    for(const edge of layout.edges)
    {
        const source = edge.sources[0];
        const target = edge.targets[0];
        const edgeName = source+'__'+target;
        map.set(edgeName, edge.sections[0]);

        if(!nodesEdgesMap.has(source)) nodesEdgesMap.set(source,[]);
        if(!nodesEdgesMap.has(target)) nodesEdgesMap.set(target,[]);
        nodesEdgesMap.get(source).push(edgeName);
        nodesEdgesMap.get(target).push(edgeName);
    }
}

export async function render_graph(plugin: DefaultPlugin, params:ELKParams) {
    const components = plugin.data.components;
    const links = plugin.data.getLinks();
    console.log("ELK parameters",params)
    console.log("Noeuds et liens", {components, links})

    const {nodes_map, hierarchicalRender}: {
        nodes_map: NodeMap,
        hierarchicalRender: NodeData[]
    } = await elk_layout(components);

    // on vide le tableau (en gardant l'objet car exporté)
    while(renderedLayouts.length!=0)
        renderedLayouts.pop();

    while (hierarchicalRender.length !== 0) {

        const node = hierarchicalRender.pop() as NodeData;

        const layout: ElkNode = await get_elk_layout_for_children(nodes_map, links, node, params);

        save_edges_for_drawing(plugin,layout);

        renderedLayouts.push({depth:node.depth,layout});
        draw_layout(plugin, layout);
    }
}

function climb_to_depth(initialNode: NodeData, depth: number): NodeData | null {

    let node = initialNode;
    if (node.depth < depth)
        return null;

    while (node.depth > depth)
        node = node.parent;

    //console.log("climb",initialNode.raw?.id,initialNode.depth,node.raw?.id,node.depth);
    return node;
}


function get_links_for_children(nodes_map: NodeMap, all_links: ComponentLink[], parentNode: NodeData) {
    const kept_ids = new Set(parentNode.children.map(c => c.raw?.id));

    const depth = parentNode.depth + 1;
    const links = all_links
        .map((link) => {
            const source = nodes_map.get(link.source as unknown as string);
            const target = nodes_map.get(link.target as unknown as string);
            if(source==undefined || target==undefined)
            {
                console.error({error:"source or target undefined",names:[link.source,link.target], link,source,target})
                return null;
            }
            const sourceDepth = climb_to_depth(source, depth);
            const targetDepth = climb_to_depth(target, depth);
            return [sourceDepth,targetDepth];
        })
        .filter(t=>t) // discard null
        .filter(t => t[0] != t[1])
        .filter(t => t[0] && t[1]) // not null
        .filter(link => kept_ids.has(link[0].raw.id) && kept_ids.has(link[1].raw.id))

    return links.map(t => [t[0].raw.id, t[1].raw.id]);
}

async function get_elk_layout_for_children(nodes_map: NodeMap, all_links: ComponentLink[], parentNode: NodeData, params: ELKParams) {

    const layoutOptions = {'elk.algorithm': 'elk.layered',
        'spacing.baseValue': '50',
        /*'spacing.nodeNode': '100',*/
        'separateConnectedComponents': params.separateConnectedComponents ? 'true':'false',
        ...(params.interactive ? {         /* c'est ici qu'on règle le niveau d'interactivité ie. d' "incrémentalité" */
            "elk.layered.cycleBreaking.strategy": params.cycleBreaking,
            "elk.layered.layering.strategy": params.layering,
            'elk.layered.crossingMinimization.strategy': params.crossingMinimization,
            'elk.layered.nodePlacement.strategy': params.nodePlacement,
            'elk.layered.interactiveReferencePoint': params.interactiveReferencePoint,
        } : {}),
        'elk.debugMode':'true',

        'elk.direction':params.direction
    };
    const graph: ElkNode = {
        id: "root",
        layoutOptions,
        children: [],
        edges: []
    }
    graph.children = parentNode.children
        .map(c => ({
            id: c.raw.id,
            width: c.raw.drawOption.width,
            height: c.raw.drawOption.height,
            x:c.raw.drawOption.x,
            y:c.raw.drawOption.y,
            layoutOptions:{...layoutOptions},
        }))


    const links = get_links_for_children(nodes_map, all_links, parentNode);
    graph.edges = links.map(link => ({
        id: link[0] + "__" + link[1],
        sources: [link[0]],
        targets: [link[1]]
    }))

    return await elk.layout(graph);
}

function draw_layout(plugin: DefaultPlugin, layout: ElkNode) {

    const nodes: Map<string, { x: number, y: number }> = new Map(layout.children.map(e => [e.id, {x: e.x, y: e.y}]));
    const scale = 1;
    for (let i in plugin.data.components) {
        let comp = plugin.data.components[i];
        if (nodes.has(comp.id)) {
            const coord = nodes.get(comp.id)

            comp.drawOption.x = coord.x * scale;

            comp.drawOption.y = coord.y * scale;
        }
    }
}

async function elk_layout(components: Component[]): Promise<{
    hierarchicalRender: NodeData[];
    nodes_map: NodeMap
}> {

    const nodes_map = new Map(components.map(c => [c.id, {
        raw: c, children: [], parent: null, depth: 0
    }]));
    const nodes: NodeData[] = Array.from(nodes_map.values())

    /* Pour chaque noeud, on calcule les parents et les enfants */
    function findParentId(node: NodeData): string {
        for (const attr of node.raw.attributes) {
            if (["workflow", "network","workflow_id","job_id"].includes(attr.name))
                return attr.value as string;
        }
        return null;
    }

    for (const node of nodes) {

        node.parent = nodes_map.get(findParentId(node));

        if (node.parent) node.parent.children.push(node);
    }

    /* on définit une racine */
    const root = {raw: null, children: [], parent: null, depth: 0};
    for (const node of nodes) {

        if (!node.parent) {

            node.parent = root
            root.children.push(node);
        }
    }

    /* puis la profondeur */
    function computeDepth(node: NodeData): number {
        if (!node.parent) return 0;
        return computeDepth(node.parent) + 1;
    }

    for (const node of nodes) {

        node.depth = computeDepth(node);
    }

    // profondeur max

    const maxDepth = nodes.map(c => c.depth).reduce((a, b) => Math.max(a, b), -1);


    /* rendu hiérarchique : liste des noeuds */

    const hierarchicalRender: NodeData[] = [];

    for (let depth = maxDepth; depth !== 0; depth--) {
        // on prend les parents des noeuds de ce niveau
        const parents = new Set(nodes

            .filter(c => c.depth === depth)

            .map(c => c.parent));

        for (let parent of parents) {
            hierarchicalRender.push(parent)
        }
    }


    return {nodes_map, hierarchicalRender: hierarchicalRender.reverse()};
}
