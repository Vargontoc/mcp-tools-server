import { Server} from  '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { captureRejectionSymbol } from 'events'
import { request } from 'http';
import { platform } from 'os';
import { MIMEType } from 'util';

const server = new Server(
    {
    name: "MCP Server",
    version: '1.0.0',
    description: 'Servidor MCP de mejorar contexto'
    },
    {
        capabilities: {
            tools: {},
            resources: {}
        }
    }
);

// Handler para listar recursos
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: 'info://sistema',
                mimeType: 'text/plain',
                name: 'Información del sistema',
                description: 'Informacion básica del sistema donde corre el servidor MCP'
            }
        ]
    }
})

// Handler para leer recursos
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri} = request.params;
    if(uri == 'info://sistema') {
        const info = {
            platforma: process.platform,
            arquitectura: process.arch,
            version_node: process.version,
            memoria_libre: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
            actividad: `${Math.round(process.uptime())} segundos`
        }

        return {
            contents: [{
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(info, null, 2)
            }]
        }
    }

    throw new Error(`Recurso no encontrado: ${uri}`)
})


async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport);
    console.error('Servidor MCP iniciado y listo para recibir conexiones...')
}

process.on('SIGINT', async () => {
    console.error('Cerrando servidor MCP...')
    process.exit(0)
})

process.on('unhandledRejection', (error) => {
    console.error('Error no manejado:', error)
    process.exit(1)
})

if(require.main == module){
    main().catch((error) => {
        console.error('Error fatal:', error)
        process.exit(1)
    })
}