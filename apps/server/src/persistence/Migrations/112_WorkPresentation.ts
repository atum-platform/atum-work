import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE work_thread_presentation (
      thread_id TEXT PRIMARY KEY,
      epoch INTEGER NOT NULL,
      agent_instructions TEXT
    )
  `;
  // Existing provider history must continue to use its original MCP catalog.
  yield* sql`
    INSERT INTO work_thread_presentation (thread_id, epoch)
    SELECT DISTINCT thread_id, 0 FROM orchestration_v2_projection_provider_threads
  `;
});
