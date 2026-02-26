import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email Service using AWS SES
 * Preserves functionality from src/modules/email/email.service.ts
 */
@Injectable()
export class EmailService {
  private sesClient: SESClient;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('aws.region') ?? 'us-east-2';

    this.sesClient = new SESClient({
      region,
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId') ?? '',
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey') ?? '',
      },
    });
  }

  async sendEmail(params: SendEmailParams): Promise<void> {
    const { to, subject, html, text } = params;
    const fromEmail = this.configService.get<string>('ses.fromEmail');
    const fromName = this.configService.get<string>('ses.fromName');

    const command = new SendEmailCommand({
      Source: `${fromName} <${fromEmail}>`,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: html,
            Charset: 'UTF-8',
          },
          ...(text !== undefined &&
            text !== '' && {
              Text: {
                Data: text,
                Charset: 'UTF-8',
              },
            }),
        },
      },
    });

    await this.sesClient.send(command);
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    const tokenTtlMinutes = this.configService.get<number>('passwordReset.tokenTtlMinutes') ?? 60;
    const subject = 'Reset Your Password';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
  sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">TraderLion</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>

    <p>We received a request to reset your password. Click the button below to create a new password:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;
        text-decoration: none; padding: 14px 40px; border-radius: 6px;
        font-weight: 600; font-size: 16px;">Reset Password</a>
    </div>

    <p style="color: #666; font-size: 14px;">This link will expire in ${tokenTtlMinutes} minutes for security reasons.</p>

    <p style="color: #666; font-size: 14px;">If you didn't request a password reset,
      you can safely ignore this email. Your password will remain unchanged.</p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; margin-bottom: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #667eea; font-size: 12px; word-break: break-all; margin-top: 5px;">${resetUrl}</p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p style="margin: 0;">This email was sent by TraderLion.</p>
    <p style="margin: 5px 0 0 0;">Please do not reply to this email.</p>
  </div>
</body>
</html>
`;

    const text = `
Reset Your Password

We received a request to reset your password.

Click the link below to create a new password:
${resetUrl}

This link will expire in ${tokenTtlMinutes} minutes for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
This email was sent by TraderLion.
Please do not reply to this email.
`;

    await this.sendEmail({ to: email, subject, html, text });
  }
}
