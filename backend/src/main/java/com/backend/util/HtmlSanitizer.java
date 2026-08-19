package com.backend.util;

import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;

public final class HtmlSanitizer {
    private HtmlSanitizer() {
    }

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
