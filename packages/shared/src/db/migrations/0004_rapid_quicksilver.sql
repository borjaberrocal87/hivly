DROP INDEX "idx_embeddings_channel";--> statement-breakpoint
CREATE INDEX "idx_embeddings_channel_created" ON "embeddings" USING btree ("channel_id","created_at" DESC NULLS LAST);