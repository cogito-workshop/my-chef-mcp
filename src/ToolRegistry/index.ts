import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { cookbook } from '../CookbookManager/index.js';
import { ToolRegistry } from './ToolRegistry.js';

export const toolRegistry = (server: McpServer) =>
  new ToolRegistry(server, cookbook);
