// Consume startup secrets before provider subprocesses can inherit the server environment.
export const endpoint = process.env.ATUM_WORK_CONNECTOR_URL;
export const token = process.env.ATUM_WORK_CONNECTOR_TOKEN;
delete process.env.ATUM_WORK_CONNECTOR_URL;
delete process.env.ATUM_WORK_CONNECTOR_TOKEN;
export const configured = () => endpoint !== undefined && token !== undefined;
