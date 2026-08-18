package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.entities.NotificationType;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final boolean mailEnabled;
    private final String frontendBaseUrl;

    public EmailService(JavaMailSender mailSender, AppProperties appProperties) {
        this.mailSender = mailSender;
        this.fromAddress = appProperties.getMail().getFrom();
        this.mailEnabled = appProperties.getMail().isEnabled();
        this.frontendBaseUrl = trimTrailingSlash(appProperties.getFrontend().getBaseUrl());
    }

    /**
     * Sends a notification email. Takes plain primitives (not a JPA entity) because it runs
     * asynchronously on a separate thread and after the originating transaction has committed,
     * where a managed/lazy entity would no longer be attached to a session. The recipient's
     * preference check is the caller's responsibility (done while the entity is still managed).
     */
    @Async("emailExecutor")
    public void sendNotificationEmail(String toEmail, String recipientFirstName,
                                      String message, NotificationType type, String link) {
        if (!mailEnabled) {
            return;
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

            helper.setFrom(fromAddress);
            helper.setTo(toEmail);
            helper.setSubject(getSubjectForType(type));
            helper.setText(buildHtmlEmail(recipientFirstName, message, link), true);

            mailSender.send(mimeMessage);
            log.info("Email notification sent to {} for type {}", toEmail, type);
        } catch (Exception e) {
            log.error("Failed to send email notification to {}: {}", toEmail, e.getMessage(), e);
        }
    }

    @Async("emailExecutor")
    public void sendInvitationEmail(String recipientEmail, String projectName, String inviterName) {
        if (!mailEnabled) return;

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");

            helper.setFrom(fromAddress);
            helper.setTo(recipientEmail);
            helper.setSubject("FlowLink - You've been invited to join a project");
            helper.setText(buildInvitationHtml(recipientEmail, projectName, inviterName), true);

            mailSender.send(mimeMessage);
            log.info("Invitation email sent to {}", recipientEmail);
        } catch (Exception e) {
            log.error("Failed to send invitation email to {}: {}", recipientEmail, e.getMessage(), e);
        }
    }

    private String buildInvitationHtml(String email, String projectName, String inviterName) {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="UTF-8"></head>
                <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 0;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
                               style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
                          <tr>
                            <td style="background-color: #0f172a; padding: 24px 32px;">
                              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">FlowLink</h1>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 32px;">
                              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">Hello,</p>
                              <p style="margin: 0 0 16px 0; color: #1e293b; font-size: 15px; line-height: 1.6;">
                                <strong>%s</strong> has invited you to collaborate on the project
                                <strong>"%s"</strong> in FlowLink.
                              </p>
                              <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 15px; line-height: 1.6;">
                                Create a free account to get started:
                              </p>
                              <a href="%s/register"
                                 style="display: inline-block; padding: 12px 28px; background-color: #0f172a;
                                        color: #ffffff; text-decoration: none; border-radius: 8px;
                                        font-size: 14px; font-weight: 600;">
                                Join FlowLink
                              </a>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 20px 32px; border-top: 1px solid #e2e8f0;">
                              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                                This invitation was sent to %s. If you didn't expect this, you can safely ignore it.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(
                escapeHtml(inviterName),
                escapeHtml(projectName),
                escapeHtml(frontendBaseUrl),
                escapeHtml(email)
        );
    }

    private String getSubjectForType(NotificationType type) {
        return switch (type) {
            case TASK_ASSIGNED -> "FlowLink - You've been assigned a task";
            case TASK_UPDATED -> "FlowLink - A task has been updated";
            case TASK_DELETED -> "FlowLink - A task has been deleted";
            case TASK_COMMENT -> "FlowLink - New comment on a task";
            case COMMENT_REPLY -> "FlowLink - New reply to your comment";
            case COMMENT_REACTION -> "FlowLink - New reaction to your comment";
            case PROJECT_INVITATION -> "FlowLink - You've been invited to a project";
            case PROJECT_UPDATED -> "FlowLink - A project has been updated";
            case MEMBER_REMOVED -> "FlowLink - You've been removed from a project";
        };
    }

    private String buildHtmlEmail(String recipientFirstName, String message, String link) {
        String buttonHtml = "";
        var absoluteLink = toAbsoluteLink(link);
        if (absoluteLink != null) {
            buttonHtml = """
                    <tr>
                      <td style="padding: 24px 0 0 0;">
                        <a href="%s"
                           style="display: inline-block; padding: 12px 28px; background-color: #0f172a;
                                  color: #ffffff; text-decoration: none; border-radius: 8px;
                                  font-size: 14px; font-weight: 600;">
                          View Details
                        </a>
                      </td>
                    </tr>
                    """.formatted(escapeHtml(absoluteLink));
        }

        return """
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="UTF-8"></head>
                <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 0;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
                               style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
                          <!-- Header -->
                          <tr>
                            <td style="background-color: #0f172a; padding: 24px 32px;">
                              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">
                                FlowLink
                              </h1>
                            </td>
                          </tr>
                          <!-- Body -->
                          <tr>
                            <td style="padding: 32px;">
                              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td>
                                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">
                                      Hi %s,
                                    </p>
                                    <p style="margin: 0; color: #1e293b; font-size: 15px; line-height: 1.6;">
                                      %s
                                    </p>
                                  </td>
                                </tr>
                                %s
                              </table>
                            </td>
                          </tr>
                          <!-- Footer -->
                          <tr>
                            <td style="padding: 20px 32px; border-top: 1px solid #e2e8f0;">
                              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                                You received this email because of your notification preferences in FlowLink.
                                You can update your email settings in your account preferences.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(
                escapeHtml(recipientFirstName),
                escapeHtml(message),
                buttonHtml
        );
    }

    /**
     * Turns an application-relative link into an absolute one the recipient can actually click,
     * and refuses anything that is not a relative path — so a notification link can never become
     * a redirect to another host or a {@code javascript:} URI.
     */
    private String toAbsoluteLink(String link) {
        if (link == null || link.isBlank()) {
            return null;
        }
        var trimmed = link.trim();
        if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
            log.warn("Refusing to embed a non-relative notification link: {}", trimmed);
            return null;
        }
        return frontendBaseUrl + trimmed;
    }

    private static String trimTrailingSlash(String url) {
        return url != null && url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
