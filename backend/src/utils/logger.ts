import winston from 'winston';

const SENSITIVE_KEY_REGEX = /(key|secret|token|password|auth|credential|access_key|private)/i;

export function maskString(val: string): string {
  if (!val || typeof val !== 'string') return val;
  if (val.length <= 4) return '****';
  // Keep first 2 and last 2 characters, mask the middle
  return `${val.substring(0, 2)}****${val.substring(val.length - 2)}`;
}

export function sanitizeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    // Mask potential bearer tokens or standard API keys in strings
    return data
      .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]{8,}/gi, '$1[MASKED_TOKEN]')
      .replace(/(Basic\s+)[A-Za-z0-9+/=]{8,}/gi, '$1[MASKED_BASIC_AUTH]')
      .replace(/(AKIA[0-9A-Z]{16})/g, '$1[AWS_KEY]')
      .replace(/(sk-[a-zA-Z0-9_-]{20,})/g, 'sk-[MASKED]');
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (SENSITIVE_KEY_REGEX.test(k) && typeof v === 'string') {
        cleaned[k] = maskString(v);
      } else {
        cleaned[k] = sanitizeData(v);
      }
    }
    return cleaned;
  }

  return data;
}

const secretMaskFormat = winston.format((info) => {
  const sanitized = sanitizeData(info);
  Object.assign(info, sanitized);
  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    secretMaskFormat(),
    winston.format.json()
  ),
  defaultMeta: { app: 'cyberforce-monitor' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `[${timestamp}] [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});
