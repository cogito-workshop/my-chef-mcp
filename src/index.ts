#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { toolRegistry } from './ToolRegistry/index.js';

// create MCP instance
const server = new McpServer({
  name: 'mychef-mcp',
  version: '0.1.1',
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
    process.exit(0);
  }
}

// process.on('SIGINT', async () => {
//   console.log('Received SIGINT. Cleaning up...');
//   try {
//     // Perform asynchronous cleanup tasks here
//     await cleanupTasks();
//   } catch (error) {
//     console.error('Error during cleanup:', error);
//   } finally {
//     process.exit(0);
//   }
// });

// async function cleanupTasks(): Promise<void> {
//   // Example: Close database connections, stop servers, etc.
//   // await db.close();
//   // await server.stop();
// }

startServer();
