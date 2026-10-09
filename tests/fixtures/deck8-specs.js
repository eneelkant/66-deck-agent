// Replays of what Vertex AI returned for deck 8 (read back from the slides)
module.exports = [
 { title: 'Governed AI development pathway', lead: 'End-to-end flow from developer input through governed development stages to deployed AI applications.', type: 'process',
   groups: [{ id: 'd', label: 'DEVELOPERS', kind: 'lane' }, { id: 'f', label: 'AGENT FACTORY', kind: 'lane' }, { id: 'p', label: 'DEPLOYMENT', kind: 'lane' }],
   nodes: [ { id: 'in', label: 'Developer input', sub: 'Code, prompts, artifacts', kind: 'start', group: 'd' }, { id: 'gh', label: 'Governance hub', sub: 'Boards, DevSecOps, CI/CD', group: 'd', focal: true },
     { id: 'mc', label: 'Mandatory controls', sub: 'Security, sandbox, validation', group: 'd' }, { id: 'id', label: 'Idea & design', sub: 'Define agent architecture', group: 'f' },
     { id: 'bv', label: 'Build & validate', sub: 'Develop and test agents', group: 'f', focal: true }, { id: 'de', label: 'Deploy', sub: 'Release to production', group: 'f' },
     { id: 'ap', label: 'Deployed AI applications', sub: 'Prod environment', kind: 'end', group: 'p' } ],
   edges: [ { from: 'in', to: 'id', label: 'Initiates' }, { from: 'id', to: 'bv' }, { from: 'bv', to: 'de' }, { from: 'de', to: 'ap', label: 'Releases' },
     { from: 'gh', to: 'id', label: 'Guides' }, { from: 'gh', to: 'bv', label: 'Oversees' }, { from: 'gh', to: 'de', label: 'Approves' }, { from: 'mc', to: 'bv', label: 'Checks' }, { from: 'mc', to: 'de', label: 'Secures' } ] },
 { title: '66degrees hub-and-spoke AI development process', lead: 'The core stages and governance layers for AI agent development from departmental initiatives to secure deployment.', type: 'process',
   groups: [{ id: 'a', label: 'DEPARTMENTAL INITIATIVES', kind: 'lane' }, { id: 'h', label: 'AGENT FACTORY HUB', kind: 'lane' }, { id: 'z', label: 'DEPLOYMENT & GOVERNANCE', kind: 'lane' }],
   nodes: [ { id: 'fs', label: 'FDE sandbox stacks', sub: 'Configured IDE, datasets', kind: 'store', group: 'a' }, { id: 'da', label: 'Departmental AI dev', sub: 'Sandbox, governance, app dev', group: 'a' },
     { id: 'mc', label: 'Mandatory controls', sub: 'DevSecOps, governance, CI/CD', group: 'h' }, { id: 'ss', label: 'Synthetic sandbox env', sub: 'ISCDE Agents, synthetic data', group: 'h' },
     { id: 'ad', label: 'AI agent development process', sub: 'Idea, design, build, validate, deploy', group: 'h', focal: true },
     { id: 'gw', label: 'Unified governance wrapper', sub: 'Risk management, pathway', group: 'z' }, { id: 'ac', label: 'Agent catalog & arch', sub: 'Discoverability, multi-agent', group: 'z' },
     { id: 'sd', label: 'Secure data access', sub: 'Corporate data, MCP servers', group: 'z' }, { id: 'dp', label: 'Deployed AI applications', sub: 'Production environment', kind: 'end', group: 'z' } ],
   edges: [ { from: 'fs', to: 'da' }, { from: 'da', to: 'ad', label: 'Initiates' }, { from: 'mc', to: 'ss' }, { from: 'ss', to: 'ad' }, { from: 'ad', to: 'ac', label: 'Produces' },
     { from: 'ad', to: 'sd', label: 'Requires' }, { from: 'ac', to: 'sd' }, { from: 'sd', to: 'dp' }, { from: 'gw', to: 'da', label: 'Oversees', style: 'dashed' }, { from: 'gw', to: 'ad', style: 'dashed' }, { from: 'gw', to: 'ac', style: 'dashed' } ] }
];
