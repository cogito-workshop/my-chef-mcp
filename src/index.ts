#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { toolRegistry } from './ToolRegistry/index.js';

// create MCP instance
const server = new McpServer({
  name: 'my-chef-mcp',
  version: '0.1.0',
  capabilities: {
    resources: {},
    tools: {},
  },
});

export async function startServer() {
  // start MCP server
  const transport = new StdioServerTransport();

  toolRegistry(server);

  try {
    await server.connect(transport);
  } catch (error) {
    console.error('starting server failed:', error);
    process.exit(1);
  }
}

startServer();
