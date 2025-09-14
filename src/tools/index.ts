import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { getWeatherTool } from "./weather";

export function registerTools(server: McpServer) {
    getWeatherTool(server)
}