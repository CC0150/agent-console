-- Comment on table "workspaces"
COMMENT ON TABLE "workspaces" IS '工作区：承载一组任务的工作空间';
COMMENT ON COLUMN "workspaces"."id" IS '工作区唯一标识（UUID）';
COMMENT ON COLUMN "workspaces"."name" IS '工作区名称';
COMMENT ON COLUMN "workspaces"."description" IS '工作区描述';
COMMENT ON COLUMN "workspaces"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "workspaces"."updated_at" IS '最近更新时间（UTC）';

-- Comment on table "tasks"
COMMENT ON TABLE "tasks" IS '任务：一次目标驱动的执行单元';
COMMENT ON COLUMN "tasks"."id" IS '任务唯一标识（UUID）';
COMMENT ON COLUMN "tasks"."goal" IS '任务目标描述';
COMMENT ON COLUMN "tasks"."workspace_id" IS '所属工作区 ID';
COMMENT ON COLUMN "tasks"."status" IS '任务状态（如 pending、running、completed、failed）';
COMMENT ON COLUMN "tasks"."model" IS '执行任务使用的模型标识';
COMMENT ON COLUMN "tasks"."current_step" IS '当前执行步骤序号（从 0 开始）';
COMMENT ON COLUMN "tasks"."total_steps" IS '任务总步骤数';
COMMENT ON COLUMN "tasks"."error" IS '任务失败时的错误信息';
COMMENT ON COLUMN "tasks"."created_at" IS '创建时间（UTC）';
COMMENT ON COLUMN "tasks"."updated_at" IS '最近更新时间（UTC）';
COMMENT ON COLUMN "tasks"."started_at" IS '开始执行时间（UTC）';
COMMENT ON COLUMN "tasks"."finished_at" IS '任务完成时间（UTC）';

-- Comment on table "task_events"
COMMENT ON TABLE "task_events" IS '任务事件：任务执行过程中产生的事件流';
COMMENT ON COLUMN "task_events"."id" IS '事件唯一标识（UUID）';
COMMENT ON COLUMN "task_events"."task_id" IS '所属任务 ID';
COMMENT ON COLUMN "task_events"."seq" IS '事件序号（同一任务内唯一且递增）';
COMMENT ON COLUMN "task_events"."type" IS '事件类型';
COMMENT ON COLUMN "task_events"."payload" IS '事件负载（JSONB）';
COMMENT ON COLUMN "task_events"."created_at" IS '事件创建时间（UTC）';

-- Comment on table "artifacts"
COMMENT ON TABLE "artifacts" IS '任务制品：任务生成的文件或产出物元数据';
COMMENT ON COLUMN "artifacts"."id" IS '制品唯一标识（UUID）';
COMMENT ON COLUMN "artifacts"."task_id" IS '所属任务 ID';
COMMENT ON COLUMN "artifacts"."name" IS '制品名称';
COMMENT ON COLUMN "artifacts"."storage_key" IS '对象存储键（全局唯一）';
COMMENT ON COLUMN "artifacts"."mime_type" IS '制品 MIME 类型';
COMMENT ON COLUMN "artifacts"."size_bytes" IS '制品大小（字节）';
COMMENT ON COLUMN "artifacts"."created_at" IS '制品创建时间（UTC）';
