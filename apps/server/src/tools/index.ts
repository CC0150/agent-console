import { toolRegistry } from "./registry";
import { httpRequestTool } from "./http-request";
import { searchJobsTool } from "./search-jobs";
import { writeReportTool } from "./write-report";

toolRegistry.register(httpRequestTool);
toolRegistry.register(searchJobsTool);
toolRegistry.register(writeReportTool);

export { toolRegistry };
