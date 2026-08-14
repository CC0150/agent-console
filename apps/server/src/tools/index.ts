import { toolRegistry } from "./registry";
import { httpRequestTool } from "./http-request";
import { writeReportTool } from "./write-report";

toolRegistry.register(httpRequestTool);
toolRegistry.register(writeReportTool);

export { toolRegistry };
