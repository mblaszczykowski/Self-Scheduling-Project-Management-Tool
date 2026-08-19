package com.backend.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("HtmlSanitizer")
class HtmlSanitizerTest {
    @Nested
    @DisplayName("Rich text keeps everything the editor can produce")
    class RichTextRoundTrip {
        @Test
        @DisplayName("keeps headings, which the comment safelist would discard")
        void keepsHeadings() {
            var cleaned = HtmlSanitizer.sanitizeRichText("<h1>One</h1><h3>Three</h3>");

            assertThat(cleaned).contains("<h1>One</h1>").contains("<h3>Three</h3>");
        }

        @Test
        @DisplayName("keeps tables with their span and width attributes")
        void keepsTables() {
            var html = "<table><tbody><tr><th colspan=\"2\" colwidth=\"120\">H</th></tr>"
                    + "<tr><td rowspan=\"2\">C</td></tr></tbody></table>";

            var cleaned = HtmlSanitizer.sanitizeRichText(html);

            assertThat(cleaned).contains("<table>").contains("colspan=\"2\"")
                    .contains("colwidth=\"120\"").contains("rowspan=\"2\"");
        }

        @Test
        @DisplayName("keeps task-list markers, alignment and colour")
        void keepsEditorAttributes() {
            var html = "<ul data-type=\"taskList\"><li data-checked=\"true\">Done</li></ul>"
                    + "<p style=\"text-align: center\">Centered</p>"
                    + "<p><span style=\"color: #ff0000\">Red</span></p>";

            var cleaned = HtmlSanitizer.sanitizeRichText(html);

            assertThat(cleaned).contains("data-type=\"taskList\"").contains("data-checked=\"true\"")
                    .contains("text-align").contains("color");
        }

        @Test
        @DisplayName("keeps highlight, underline, strikethrough, rules and code blocks")
        void keepsInlineMarks() {
            var html = "<p><mark>hl</mark><u>u</u><s>s</s><strong>b</strong><em>i</em></p>"
                    + "<hr><pre><code>x = 1;</code></pre><blockquote><p>q</p></blockquote>";

            var cleaned = HtmlSanitizer.sanitizeRichText(html);

            assertThat(cleaned).contains("<mark>").contains("<u>").contains("<s>")
                    .contains("<strong>").contains("<em>").contains("<hr>")
                    .contains("<code>").contains("<blockquote>");
        }

        @Test
        @DisplayName("keeps a same-origin image src, which is what an embedded upload looks like")
        void keepsRelativeImageSrc() {
            var cleaned = HtmlSanitizer.sanitizeRichText(
                    "<img src=\"/files/3f9e2b1c-4a5f.png\" alt=\"spec\">");

            assertThat(cleaned).contains("src=\"/files/3f9e2b1c-4a5f.png\"");
        }

        @Test
        @DisplayName("keeps a same-origin link href")
        void keepsRelativeAnchorHref() {
            var cleaned = HtmlSanitizer.sanitizeRichText(
                    "<p><a href=\"/projects?selectedIssue=WEB-1\">WEB-1</a></p>");

            assertThat(cleaned).contains("href=\"/projects?selectedIssue=WEB-1\"");
        }

        @Test
        @DisplayName("keeps a relative src in a comment body too")
        void keepsRelativeSrcInComments() {
            var cleaned = HtmlSanitizer.sanitizeComment("<img src=\"/files/a.png\">");

            assertThat(cleaned).contains("src=\"/files/a.png\"");
        }

        @Test
        @DisplayName("keeps links and images the editor inserts")
        void keepsLinksAndImages() {
            var html = "<p><a href=\"https://example.com\">link</a></p>"
                    + "<img src=\"https://example.com/a.png\" alt=\"a\" width=\"10\" height=\"20\">";

            var cleaned = HtmlSanitizer.sanitizeRichText(html);

            assertThat(cleaned).contains("href=\"https://example.com\"")
                    .contains("src=\"https://example.com/a.png\"")
                    .contains("width=\"10\"").contains("height=\"20\"");
        }
    }

    @Nested
    @DisplayName("Rich text still strips every script vector")
    class RichTextStripsScripts {
        @Test
        @DisplayName("drops script elements and their contents")
        void dropsScriptTags() {
            var cleaned = HtmlSanitizer.sanitizeRichText("<p>ok</p><script>alert(1)</script>");

            assertThat(cleaned).doesNotContain("script").doesNotContain("alert(1)").contains("ok");
        }

        @Test
        @DisplayName("drops event-handler attributes")
        void dropsEventHandlers() {
            var cleaned = HtmlSanitizer.sanitizeRichText(
                    "<img src=\"https://e.com/a.png\" onerror=\"alert(1)\"><p onclick=\"alert(2)\">x</p>");

            assertThat(cleaned).doesNotContain("onerror").doesNotContain("onclick")
                    .doesNotContain("alert");
        }

        @Test
        @DisplayName("drops javascript: and data: URLs")
        void dropsDangerousProtocols() {
            var cleaned = HtmlSanitizer.sanitizeRichText(
                    "<a href=\"javascript:alert(1)\">x</a><a href=\"data:text/html,<b>y\">z</a>");

            assertThat(cleaned).doesNotContain("javascript:").doesNotContain("data:text/html");
        }

        @Test
        @DisplayName("still drops javascript: and data: on an image src with a base URI in play")
        void dropsDangerousImageProtocols() {
            var cleaned = HtmlSanitizer.sanitizeRichText(
                    "<img src=\"javascript:alert(1)\"><img src=\"data:image/svg+xml;base64,AAAA\">");

            assertThat(cleaned).doesNotContain("javascript:").doesNotContain("data:image");
        }

        @Test
        @DisplayName("drops iframes, objects, embeds and form controls")
        void dropsEmbeddedContent() {
            var cleaned = HtmlSanitizer.sanitizeRichText(
                    "<iframe src=\"https://e.com\"></iframe><object></object><embed>"
                            + "<form><input value=\"x\"></form><style>body{}</style>");

            assertThat(cleaned).doesNotContain("iframe").doesNotContain("object")
                    .doesNotContain("embed").doesNotContain("<form").doesNotContain("<input")
                    .doesNotContain("<style");
        }

        @Test
        @DisplayName("drops svg, the type the upload allowlist also refuses")
        void dropsSvg() {
            var cleaned = HtmlSanitizer.sanitizeRichText("<svg><script>alert(1)</script></svg>");

            assertThat(cleaned).doesNotContain("svg").doesNotContain("alert");
        }
    }

    @Nested
    @DisplayName("Null and comment handling")
    class Basics {
        @Test
        @DisplayName("passes null through untouched for both modes")
        void handlesNull() {
            assertThat(HtmlSanitizer.sanitizeRichText(null)).isNull();
            assertThat(HtmlSanitizer.sanitizeComment(null)).isNull();
        }

        @Test
        @DisplayName("comment sanitisation keeps basic formatting and strips scripts")
        void sanitizesComments() {
            var cleaned = HtmlSanitizer.sanitizeComment("<p><strong>hi</strong></p><script>x</script>");

            assertThat(cleaned).contains("<strong>hi</strong>").doesNotContain("script");
        }
    }
}
