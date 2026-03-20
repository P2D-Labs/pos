import { env } from "./config/env";
import { app } from "./app";

app.listen(Number(env.PORT), () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${env.PORT}`);
});
