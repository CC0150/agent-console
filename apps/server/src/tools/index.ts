import { toolRegistry } from "./registry";
import { httpRequestTool } from "./http-request";
import { searchJobsTool } from "./search-jobs";

toolRegistry.register(httpRequestTool);
toolRegistry.register(searchJobsTool);

export { toolRegistry };
