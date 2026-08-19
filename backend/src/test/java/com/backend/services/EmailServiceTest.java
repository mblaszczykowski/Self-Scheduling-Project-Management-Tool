package com.backend.services;

import com.backend.config.AppProperties;
import com.backend.entities.NotificationType;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailServiceTest {
    private static final String BASE_URL = "https://app.example.com";

    @Mock
    private JavaMailSender mailSender;

    private AppProperties appProperties;
    private EmailService emailService;

    @BeforeEach
    void setUp() {
        appProperties = new AppProperties();
        appProperties.getMail().setEnabled(true);
        appProperties.getFrontend().setBaseUrl(BASE_URL);
        emailService = new EmailService(mailSender, appProperties);

        lenient().when(mailSender.createMimeMessage())
                .thenAnswer(invocation -> new MimeMessage(Session.getInstance(new Properties())));
    }

    private String sentHtml() throws Exception {
        var captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        return extractText(captor.getValue());
    }

    private String extractText(Part part) throws Exception {
        Object content = part.getContent();
        if (content instanceof String text) {
            return text;
        }
        if (content instanceof MimeMultipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                var found = extractText(multipart.getBodyPart(i));
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    @Nested
    @DisplayName("app.mail.enabled gate")
    class MailEnabledGate {
        @Test
        @DisplayName("sends nothing at all when mail is disabled")
        void doesNothingWhenMailIsDisabled() {
            appProperties.getMail().setEnabled(false);
            emailService = new EmailService(mailSender, appProperties);

            emailService.sendNotificationEmail("user@example.com", "Ada", "Hello",
                    NotificationType.TASK_UPDATED, "/projects?selectedIssue=PROJ-1");
            emailService.sendInvitationEmail("user@example.com", "Project X", "Ada");

            verifyNoInteractions(mailSender);
        }

        @Test
        @DisplayName("sends a notification email when mail is enabled")
        void sendsWhenMailIsEnabled() throws Exception {
            emailService.sendNotificationEmail("user@example.com", "Ada", "Hello",
                    NotificationType.TASK_UPDATED, null);

            verify(mailSender).send(org.mockito.ArgumentMatchers.any(MimeMessage.class));
        }
    }

    @Nested
    @DisplayName("toAbsoluteLink, driven through sendNotificationEmail")
    class AbsoluteLinkHandling {
        @Test
        @DisplayName("accepts a relative link and prefixes it with the configured frontend base URL")
        void acceptsARelativeLink() throws Exception {
            emailService.sendNotificationEmail("user@example.com", "Ada", "Your task changed",
                    NotificationType.TASK_UPDATED, "/projects?selectedIssue=PROJ-1");

            assertThat(sentHtml())
                    .contains("href=\"" + BASE_URL + "/projects?selectedIssue=PROJ-1\"");
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "//evil.com/steal",
                "http://evil.com/steal",
                "https://evil.com/steal",
                "javascript:alert(1)"
        })
        @DisplayName("refuses a link that is not a single relative path, so it cannot redirect off-host")
        void refusesANonRelativeLink(String link) throws Exception {
            emailService.sendNotificationEmail("user@example.com", "Ada", "Your task changed",
                    NotificationType.TASK_UPDATED, link);

            var html = sentHtml();
            assertThat(html).doesNotContain("View Details");
            assertThat(html).doesNotContain(link);
            assertThat(html).doesNotContain("evil.com");
        }

        @Test
        @DisplayName("omits the button entirely when there is no link")
        void omitsButtonWhenLinkIsNull() throws Exception {
            emailService.sendNotificationEmail("user@example.com", "Ada", "Your task changed",
                    NotificationType.TASK_UPDATED, null);

            assertThat(sentHtml()).doesNotContain("View Details");
        }
    }

    @Nested
    @DisplayName("escapeHtml, driven through the public send methods")
    class HtmlEscaping {
        @Test
        @DisplayName("escapes &, <, >, \" and ' in caller-supplied notification text")
        void escapesNotificationText() throws Exception {
            emailService.sendNotificationEmail("user@example.com", "<b>Ada</b>",
                    "5 < 10 & \"quoted\" 'name'", NotificationType.TASK_UPDATED, null);

            var html = sentHtml();
            assertThat(html).doesNotContain("<b>Ada</b>");
            assertThat(html).contains("&lt;b&gt;Ada&lt;/b&gt;");
            assertThat(html).contains("5 &lt; 10 &amp; &quot;quoted&quot; &#39;name&#39;");
        }

        @Test
        @DisplayName("escapes an invitation's inviter name and project name")
        void escapesInvitationText() throws Exception {
            emailService.sendInvitationEmail("user@example.com",
                    "<script>alert(1)</script>", "R&D <Team>");

            var html = sentHtml();
            assertThat(html).doesNotContain("<script>alert(1)</script>");
            assertThat(html).contains("&lt;script&gt;alert(1)&lt;/script&gt;");
            assertThat(html).contains("R&amp;D &lt;Team&gt;");
        }
    }
}
