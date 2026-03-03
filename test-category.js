const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');
chromium.use(stealth());

const url = 'https://www.google.com/maps/place/The+New+York+Website+Designer/@40.7163013,-74.0041183,17z/data=!3m1!4b1!4m6!3m5!1s0x89c259ba5c5f85bf:0x51c6c514d232b70f!8m2!3d40.7162973!4d-74.0015434!16s%2Fg%2F11b6xxy0qg';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });

    // Look for elements that might be the category (e.g. contains "Website designer")
    const categoryEls = await page.evaluate(() => {
        const textToFind = "Website designer";
        const results = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            if (node.nodeValue.includes(textToFind)) {
                let parent = node.parentElement;
                while (parent && parent.tagName !== 'BODY') {
                    if (parent.tagName === 'BUTTON' || parent.className || parent.getAttribute('jsaction')) {
                        results.push({
                            tag: parent.tagName,
                            className: parent.className,
                            jsaction: parent.getAttribute('jsaction'),
                            ariaLabel: parent.getAttribute('aria-label'),
                            text: parent.innerText,
                            html: parent.outerHTML.substring(0, 150)
                        });
                        break;
                    }
                    parent = parent.parentElement;
                }
            }
        }
        return results;
    });

    console.log(JSON.stringify(categoryEls, null, 2));
    await browser.close();
})();
