import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

const RELATIONSHIP_COLORS = {
  ally: '#4a9e4a',
  rival: '#c45a5a',
  mentor: '#6a8ec4',
  student: '#8ab4d4',
  family: '#c4a35a',
  enemy: '#8a2a2a',
};

export default function CharacterRelationshipGraph({ characters, factions, relationships }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const factionMap = {};
  factions.forEach(f => { factionMap[f.id] = f; });

  useEffect(() => {
    if (!svgRef.current || !characters.length) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll('*').remove();

    // Build nodes and links
    const nodes = characters.map(c => ({
      id: c.id, name: c.name, han: c.han,
      faction: c.faction, power: c.power,
      color: factionMap[c.faction]?.color || '#c4a35a',
    }));

    const links = relationships.map(r => ({
      source: r.source,
      target: r.target,
      type: r.type,
      color: RELATIONSHIP_COLORS[r.type] || '#666',
    })).filter(l => nodes.find(n => n.id === l.source) && nodes.find(n => n.id === l.target));

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Draw links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.color)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-dasharray', d => d.type === 'enemy' ? '4,4' : 'none');

    // Draw nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x; d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      );

    // Node circles
    node.append('circle')
      .attr('r', d => 8 + d.power * 3)
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.3)
      .attr('stroke', d => d.color)
      .attr('stroke-width', 2)
      .style('cursor', 'pointer');

    // Node labels
    node.append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', d => -(12 + d.power * 3))
      .attr('fill', '#c4a35a')
      .attr('font-size', 11)
      .attr('font-family', 'var(--font-body)')
      .style('pointer-events', 'none');

    // Hover
    node.on('mouseover', (event, d) => {
      const rect = svgRef.current.getBoundingClientRect();
      setTooltip({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top - 10,
        name: d.name, han: d.han,
        faction: factionMap[d.faction]?.name || d.faction,
      });
    }).on('mouseout', () => setTooltip(null));

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [characters, relationships]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 500, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)',
          padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--gold)', borderRadius: 6,
          fontSize: 12, color: 'var(--text)', pointerEvents: 'none', zIndex: 10,
        }}>
          <div style={{ color: 'var(--gold)', fontWeight: 600 }}>{tooltip.name} <span style={{ fontFamily: 'var(--font-han)', fontSize: 11 }}>{tooltip.han}</span></div>
          <div style={{ color: 'var(--text-dim)' }}>{tooltip.faction}</div>
        </div>
      )}
      {/* Legend */}
      <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-dim)' }}>
        {Object.entries(RELATIONSHIP_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 12, height: 2, background: color }} />
            {type}
          </div>
        ))}
      </div>
    </div>
  );
}
