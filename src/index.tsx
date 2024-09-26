import { Context, h } from "koishi";
import type Config from "./config";
import { ParallelPool } from "./utils/data";
import { render } from "./main/renderer";
import { taskTime } from "./utils/data";
import { LoliconSourceProvider } from "./main/providers/lolicon";
import { deleteMessage } from "./utils/recall"; // Import deleteMessage function

export function apply(ctx: Context, config: Config) {
  ctx
    .command("来张色图 [tag:text]", "随机一张色图")
    .option("n", "-n <value:number>", {
      fallback: 1,
    })
    .alias("色图")
    .action(async ({ session, options }, tag) => {
      await session.send("不可以涩涩哦~");

      LoliconSourceProvider.getInstance<LoliconSourceProvider>().setConfig(config);

      const messages: h[] = [];
      const pool = new ParallelPool<void>(config.maxConcurrency);

      for (let i = 0; i < Math.min(10, options.n); i++) {
        pool.add(
          taskTime(ctx, `${i + 1} image`, async () => {
            const message = await render(ctx, config, tag);
            messages.push(message);
          }),
        );
      }

      await pool.run();

      let id: string[];
      try {
        id = await taskTime(ctx, "send message", () => {
          if (config.forwardMessage) {
            return session.send(
              <>
                <message forward={config.forwardMessage}>{messages}</message>
              </>,
            );
          }

          return session.send(messages);
        });
      } catch (e) {
        ctx.logger.error(e);
      }

      if (id === undefined || id.length === 0) {
        ctx.logger.error(`消息发送失败，账号可能被风控`);

        return (
          <>
            <at id={session.userId}></at>
            <text content={" 消息发送失败了喵，账号可能被风控\n"}></text>
          </>
        );
      }

      // Add recall feature
      if (config.willRecall) {
        ctx.setTimeout(async () => {
          for (const messageId of id) {
            await deleteMessage(ctx, session.bot, session.channelId, messageId);
          }
        }, config.recallTime);
      }
    });
}

export * from "./config";
