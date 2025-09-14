import { McpServer} from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod";
import { AlertFeature } from "./types";
import { registerTools } from "./tools";

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

const server = new McpServer({
    name: "MPC Server Custom",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {}
    }
})

// Register tools
registerTools(server)


async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error("MCP Sver running")
}

main().catch((error) =>{
    console.error("Fatal error in main()", error)
    process.exit(1)
})