import * as d3 from 'd3';
import { DefaultDrawer } from 'leto-modelizer-plugin-core';

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
}

export default GithubActionDrawer;
