export interface Env {
    DB:D1Database;
    DB1:D1Database;
    DB2:D1Database;
    
      // 从wrangler.json的vars中读取
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USERNAME: string;
  // 通过wrangler secret put设置的秘密变量
  SMTP_PASSWORD: string;
}
