package com.backend.util;

import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;

/**
 * Server-side sanitisation for the two kinds of user-supplied HTML this application stores.
 *
 * <p>{@link #sanitizeComment(String)} covers comment bodies. {@link #sanitizeRichText(String)}
 * covers task and project descriptions, which the browser's rich-text editor produces: headings,
 * tables, task lists, text alignment and colour, highlights and underlines are all part of that
 * output, so the comment safelist would silently discard them. {@code HtmlSanitizerTest} pins the
 * round trip in both directions — every editor construct survives, every script vector does not.
 *
 * <p>Both modes clean against {@link #RELATIVE_BASE}. Jsoup tests an attribute's protocol against
 * the <em>absolute</em> URL, so with no base a same-origin reference such as
 * {@code /files/<uuid>.png} — which is exactly what an embedded upload looks like — resolves to
 * nothing, fails the test and has its {@code src} stripped, silently emptying every image and
 * internal link on the next save. Supplying a base makes the test meaningful while
 * {@code preserveRelativeLinks} keeps the stored value relative. {@code javascript:} and
 * {@code data:} are already absolute, so they still fail the protocol test and are still removed.
 */
public final class HtmlSanitizer {

    private HtmlSanitizer() {
    }

    /** Only ever used to resolve relative URLs for the protocol test; never written to output. */
    private static final String RELATIVE_BASE = "https://flowlink.invalid/";

    private static final Safelist COMMENT = Safelist.basicWithImages()
            .preserveRelativeLinks(true);

    private static final Safelist RICH_TEXT = Safelist.basicWithImages()
            .addTags("h1", "h2", "h3", "h4", "h5", "h6", "hr", "s", "u", "mark", "div",
                    "table", "thead", "tbody", "tfoot", "caption", "colgroup", "col", "tr", "td", "th")
            .addAttributes("table", "style", "class")
            .addAttributes("td", "colspan", "rowspan", "colwidth", "style")
            .addAttributes("th", "colspan", "rowspan", "colwidth", "style")
            .addAttributes("img", "width", "height")
            .addAttributes(":all", "class", "style", "data-type", "data-checked")
            .addProtocols("a", "href", "http", "https", "mailto")
            .preserveRelativeLinks(true);

    public static String sanitizeComment(String html) {
        return html == null ? null : Jsoup.clean(html, RELATIVE_BASE, COMMENT);
    }

    public static String sanitizeRichText(String html) {
        return html == null ? null : Jsoup.clean(html, RELATIVE_BASE, RICH_TEXT);
    }
}
