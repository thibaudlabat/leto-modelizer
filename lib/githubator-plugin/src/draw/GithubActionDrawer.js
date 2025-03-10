import * as d3 from 'd3';
import { DefaultDrawer } from 'leto-modelizer-plugin-core';
import nunjucks from 'nunjucks';

/**
 * Class to draw GithubAction components.
 */
class GithubActionDrawer extends DefaultDrawer {
  constructor(pluginData, resources, rootId, options) {
    super(pluginData, resources, rootId, {
      ...options,
      minHeight: 80,
      minWidth: 110,
      margin: 5,
    });
  }

  getSelectionTopleft(selection) {
    const box = selection.node().getBoundingClientRect();

    return {
      x: box.left,
      y: box.top,
    };
  }

  /**
   * Build a new d3 link generator for a ComponentLink
   * @param {ComponentLink} link - The link to build the generator for.
   * @returns {object} A d3 link generator.
   */
  getLinkGenerator(link) {
    const source = d3.select(`#${link.source}`);
    const target = d3.select(`#${link.target}`);

    const sourceAnchor = this.getAnchorPoint(source, target);
    const targetAnchor = this.getAnchorPoint(target, source);

    const sourceCenter = this.getSelectionCenter(source);
    const targetCenter = this.getSelectionCenter(target);

    const angle = this.getBearing(
      this.screenToSVG(sourceCenter.x, sourceCenter.y, this.svg.select('.container').node()),
      this.screenToSVG(targetCenter.x, targetCenter.y, this.svg.select('.container').node()),
    );

    let curve;

    if (angle < 45 || angle >= 315 || (angle >= 135 && angle < 225)) {
      curve = d3.curveBumpY;
    } else {
      curve = d3.curveBumpX;
    }

    return (x) => {
      const r = d3.link(curve)
        .source(() => sourceAnchor)
        .target(() => targetAnchor)(x);

      let s = r;

      const linkKey = `${link.source}__${link.target}`;
      /*
      ici on utilise les edges en sortie de ELK pour les dessiner
       */
      if (this.pluginData.__elkEdges !== undefined && this.pluginData.__elkEdges.has(linkKey)) {
        const edge = this.pluginData.__elkEdges.get(linkKey);

        const useOffsetMethod = true;
        // true = WIP
        // j'essaye de bien mettre l'origine/la destination des arêtes ...
        // pour l'instant l'un des deux est centré sur la face concernée, c'est pas le résultat
        // attendu (déacalage par rapport à ELK + superposition d'arêtes)

        if (useOffsetMethod) {
          const transform = ({ x, y }) => this.SVGToScreen(x, y, this.svg.select('.container').node());
          const points = edge.bendPoints ?? [];
          points.push(edge.endPoint);
          const current = transform(edge.startPoint);

          const tL = this.getSelectionTopleft(d3.select(source._groups[0][0].parentNode));
          const p = this.screenToSVG(tL.x, tL.y);
          const origin = transform({ x: 0, y: 0 });
          let pathSuffix = `M${current.x - origin.x + p.x},${current.y - origin.y + p.y}`;

          for (const point of points) {
            const adapted = transform(point);
            pathSuffix += `L${adapted.x - origin.x + p.x},${adapted.y - origin.y + p.y}`;
          }
          s = pathSuffix;
        } else {
          const transform = ({ x, y }) => this.SVGToScreen(x, y, this.svg.select('.container').node());
          const start = transform(edge.startPoint);

          let current = start;
          let pathSuffix = '';
          const points = edge.bendPoints ?? [];
          points.push(edge.endPoint);
          for (const point of points) {
            const adapted = transform(point);
            const dx = adapted.x - current.x;
            const dy = adapted.y - current.y;
            current = adapted;

            pathSuffix += `l${dx},${dy}`;
          }

          s = r.split('C')[0] + pathSuffix;
        }
      }

      return s;
    };
  }

  /**
   * Render links in model view.
   * @param {boolean} readOnly - Draw read-only links.
   */
  drawLinks(readOnly) {
    const pluginLinks = this.pluginData.getLinks();

    if (!pluginLinks) {
      return;
    }

    const links = this.svg
      .selectAll('.link');

    links.data(pluginLinks, (data) => data)
      .join('path')
      .filter(({ source, target }) => !d3.select(`#${source}`).empty()
            && !d3.select(`#${target}`).empty())
      .classed('link', true)
      .attr('d', (link) => {
        const generator = this.getLinkGenerator(link);

        return generator(link);
      })
      .attr('id', ({ definition, source, target }) => (
        `link-${definition.sourceRef}-${definition.attributeRef}-${source}-${target}`
      ))
      .attr('fill', 'none')
      .attr('stroke', (link) => link.definition.color)
      .attr('stroke-width', (link) => link.definition.width * this.actions.zoom.scale)
      .attr('stroke-dasharray', (link) => (
        !link.definition.dashStyle
          ? 'none'
          : link.definition.dashStyle.map((value) => value * this.actions.zoom.scale)
      ))
      .attr('marker-start', (data) => {
        const { attributeRef, sourceRef, targetRef } = data.definition;

        return data.definition.type === 'Reverse'
          ? `url(#${attributeRef}-${sourceRef}-${targetRef}-arrow)`
          : 'none';
      })
      .attr('marker-end', (data) => {
        const { attributeRef, sourceRef, targetRef } = data.definition;

        return data.definition.type !== 'Reverse'
          ? `url(#${attributeRef}-${sourceRef}-${targetRef}-arrow)`
          : 'none';
      })
      .attr('cursor', readOnly ? 'default' : 'pointer')
      .on('click', (event) => (readOnly ? null : this.clickHandler(event)));

    links.raise();
  }

  dragHandler(draggedElement, event) {
    const r = super.dragHandler(draggedElement, event);
    // discard ELK edges when moving

    if (this.pluginData.__elkNodesEdgesMap !== undefined && draggedElement.classList.contains('component')) {
      const { id } = draggedElement;
      const edges = this.pluginData.__elkNodesEdgesMap.get(id);
      if (edges !== undefined) {
        this.pluginData.__elkNodesEdgesMap.delete(id);

        for (const edge of edges) {
          this.pluginData.__elkEdges.delete(edge);
        }
      }
    }

    return r;
  }

  /**
   * Render components in model view.
   * @param {boolean} readOnly - Draw read-only components.
   */
  drawComponents(readOnly) {
    this.shadowRoot = { children: this.pluginData.components, id: '__shadowRoot', name: '' };
    const groupedNodes = this.buildTree();
    const clicked = this.clickHandler.bind(this);
    const drag = this.setupDragBehavior();
    const node = this.svg
      .select('.container')
      .selectAll('g')
      .data(groupedNodes, (data) => data)
      .join('g')
      .attr('id', ([data]) => data)
      .selectAll('g')
      .data(([, data]) => data)
      .join('g')
      .attr('id', ({ data }) => data.id)
      .on('click', readOnly ? null : clicked)
      .call(readOnly ? () => {} : drag)
      .attr('x', ({ x0 }) => x0)
      .attr('y', ({ y0 }) => y0)
      .attr('transform', ({ x0, y0 }) => `translate(${x0},${y0})`);

    node
      .filter(({ data }) => data.id !== '__shadowRoot')
      .attr('class', ({ data }) => `component
        component-${data.definition.model}
        ${data.definition.type}`)
      .html(({ data }) => nunjucks.renderString(
        this.resources.models[data.definition.model],
        {
          ...data,
          hasError: data.hasError(),
          getAttribute: (name) => data.attributes.find((attribute) => attribute.name === name),
        },
      ))
      .select('svg')
      .attr('id', ({ data }) => `svg-${data.id}`)
      .attr('height', (component) => {
        const { manuallyResized, height } = component.data.drawOption;

        return manuallyResized ? height : this.getComponentHeight(component);
      })
      .attr('width', (component) => {
        const { manuallyResized, width } = component.data.drawOption;

        return manuallyResized ? width : this.getComponentWidth(component);
      });

    node.select('.component-icon')
      .html(({ data }) => this.resources.icons[data.definition.icon]);

    node.select('rect')
      .filter((d) => d.data?.definition?.isContainer)
      .attr('height', (component) => {
        const { manuallyResized, height } = component.data.drawOption;

        return manuallyResized ? height : this.getComponentHeight(component);
      })
      .attr('width', (component) => {
        const { manuallyResized, width } = component.data.drawOption;

        return manuallyResized ? width : this.getComponentWidth(component);
      })

      // HERE
      .on('contextmenu', (event, d) => {
        event.preventDefault();
        // console.log('clic droit', { event, d });
        d.data.__ignored = !d.data.__ignored;
        d3.select(`#${d.data.id} > svg > rect`).attr('fill', d.data.__ignored ? 'red' : 'gray');
      })
      .attr('fill', 'gray')
      .filter((d) => d.data.__ignored)
      .attr('fill', 'red');

    node.select('.component-container')
      .attr('height', (component) => {
        const { manuallyResized, height } = component.data.drawOption;

        return (manuallyResized ? height : this.getComponentHeight(component))
          - this.minHeight - this.margin;
      })
      .attr('width', (component) => {
        const { manuallyResized, width } = component.data.drawOption;

        return (manuallyResized ? width : this.getComponentWidth(component)) - 2 * this.margin;
      })
      .attr('x', () => this.margin)
      .filter(({ children }) => children)
      .append(({ data }) => d3.select(`#group-${data.id}`).node());

    node.select('.component-container>rect').attr('data-parentId', ({ data }) => data.id);
  }
}

export default GithubActionDrawer;
