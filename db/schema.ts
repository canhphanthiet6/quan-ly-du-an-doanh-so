import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull(), name: text("name").notNull(), contractor: text("contractor").notNull(),
  product: text("product").notNull(), owner: text("owner").notNull(), probability: integer("probability").notNull(),
  status: text("status").notNull(), value: integer("value").notNull(), deadline: text("deadline").notNull(), nextAction: text("next_action").notNull(),
});
