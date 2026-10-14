import Handlebars from "handlebars";
import puppeteer from "puppeteer";
import htmlToDocx from "html-to-docx";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

class DocumentGenerator {
  constructor() {
    this.registerHelpers();
    try {
      const dom = new JSDOM("");
      const domPurifyFactory = DOMPurify?.default || DOMPurify;
      this.purify =
        typeof domPurifyFactory === "function"
          ? domPurifyFactory(dom.window)
          : null;
    } catch {
      this.purify = null;
    }
  }

  registerHelpers() {
    Handlebars.registerHelper("formatDate", (date) =>
      date
        ? new Date(date).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "N/A",
    );
    Handlebars.registerHelper("join", (arr, separator) =>
      Array.isArray(arr)
        ? arr.map((item) => item.name || item).join(separator)
        : "",
    );
  }

  renderHTML(templateContent, data) {
    return Handlebars.compile(templateContent)(data);
  }

  sanitizeHTML(html) {
    if (this.purify && typeof this.purify.sanitize === "function") {
      return this.purify.sanitize(html, {
        ALLOWED_TAGS: [
          "h1",
          "h2",
          "h3",
          "p",
          "ul",
          "ol",
          "li",
          "strong",
          "em",
          "br",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "span",
          "div",
        ],
        ALLOWED_ATTR: ["class", "style"],
      });
    }
    return String(html || "")
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
  }

  async generatePDF(fullHTML, _branding) {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(fullHTML, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1in", bottom: "1in", left: "0.5in", right: "0.5in" },
    });
    await browser.close();
    return buffer;
  }

  async generateDOCX(fullHTML, branding) {
    // html-to-docx properly respects the HTML structure and inline styles
    const buffer = await htmlToDocx(fullHTML, null, {
      title: branding.headerText || "Meeting Minutes",
      creator: branding.footerText || "MeetOnMemory",
    });
    return buffer;
  }
}

export default new DocumentGenerator();
