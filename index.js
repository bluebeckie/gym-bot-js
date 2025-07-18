import { chromium } from 'playwright';
import 'dotenv/config';

// --- CONFIGURATION ---
const TARGET_GYM_BRANCH = '台北小巨蛋瑜珈健身館';
const TARGET_CLASSROOM = '小巨蛋E教室'; // Adjust if needed
// const TARGET_CLASSROOM = '小巨蛋A教室'; // Adjust if needed

const CLASS_SCHEDULE = [
    { day: '周一', name: 'Pilates Mat Work 皮拉提斯(B)', time: '08:05' }, // DEV
    { day: '周二', name: 'BODYCOMBAT™  戰鬥有氧 (M)', time: '12:10' },
    { day: '周六', name: 'BODYCOMBAT™  戰鬥有氧 (M)', time: '02:45' },
    { day: '周日', name: 'BODYJAM™ 潮流舞蹈  (M)', time: '01:30' },
];

// --- TIME-BASED HELPER FUNCTIONS ---

// Maps Chinese day names to JavaScript's day-of-the-week number (Sunday=0)
const dayNameToNumber = { '周日': 0, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6 };

/**
 * Calculates the exact Date object for the next occurrence of a class.
 * @param {{day: string, time: string}} classInfo - The class schedule item.
 * @returns {Date} The full Date object for the next class session.
 */
function getNextClassDateTime(classInfo) {
    const now = new Date();
    const targetDay = dayNameToNumber[classInfo.day];
    const [hours, minutes] = classInfo.time.split(':').map(Number);

    const classDate = new Date();
    // Find the next date for the target day
    classDate.setDate(now.getDate() + (targetDay - now.getDay() + 7) % 7);
    classDate.setHours(hours, minutes, 0, 0);

    // If we've already passed the class time on the target day, aim for the following week.
    if (now.getTime() > classDate.getTime()) {
        classDate.setDate(classDate.getDate() + 7);
    }
    return classDate;
}

/**
 * Determines if a target date falls into the "next week" relative to the current date,
 * assuming the week starts on Monday.
 * @param {Date} classDate - The date of the class to check.
 * @returns {boolean} - True if the class is in the next calendar week.
 */
function isNextWeek(classDate) {
    const now = new Date();
    // Clone dates to avoid modifying them
    const date1 = new Date(now.getTime());
    const date2 = new Date(classDate.getTime());
    // Get Monday of the respective weeks
    const monday1 = new Date(date1.setDate(date1.getDate() - (date1.getDay() + 6) % 7));
    const monday2 = new Date(date2.setDate(date2.getDate() - (date2.getDay() + 6) % 7));
    // Compare the start of the weeks
    return monday2.getTime() > monday1.getTime();
}


(async () => {
    const now = new Date();
    let classToBook = null;
    let targetClassDateTime = null;

    console.log(`Script run at: ${now.toLocaleString('zh-TW')}`);
    console.log('Checking schedule for classes to book...');

    // Find which class, if any, should be booked right now.
    for (const classInfo of CLASS_SCHEDULE) {
        const classDateTime = getNextClassDateTime(classInfo);
        const bookingStart = new Date(classDateTime.getTime() - 72 * 60 * 60 * 1000); // 72 hours before
        const bookingEnd = new Date(classDateTime.getTime() - 1 * 60 * 60 * 1000);   // 1 hour before

        console.log(`- Checking "${classInfo.name}" on ${classInfo.day}. Class time: ${classDateTime.toLocaleString('zh-TW')}. Booking window: ${bookingStart.toLocaleString('zh-TW')} to ${bookingEnd.toLocaleString('zh-TW')}`);

        if (now >= bookingStart && now < bookingEnd) {
            classToBook = classInfo;
            targetClassDateTime = classDateTime;
            break; // Found our class
        }
    }

    if (!classToBook) {
        console.log('No classes are within their booking window right now. Exiting.');
        return;
    }

    console.log('---');
    console.log(`Action: Booking window is open for "${classToBook.name}" at ${classToBook.time}.`);
    console.log('---');

    // --- START AUTOMATION ---
    const { USERNAME, PASSWORD, LOGIN_URL } = process.env;
    if (!USERNAME || !PASSWORD) {
        console.error('Error: Please create a .env file and add your USERNAME and PASSWORD.');
        process.exit(1);
    }

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    try {
        // Login, navigate to search page... (same as before)
        console.log('Navigating to login page...');
        await page.goto(LOGIN_URL);
        await page.waitForLoadState('networkidle'); // Wait for the page to be fully loaded
        console.log('Filling in credentials...');
        await page.fill('input[name="ctl00$cphContents$txtUsername"]', USERNAME);
        await page.fill('input[name="ctl00$cphContents$txtPassword"]', PASSWORD);
        console.log('Logging in...');
        await Promise.all([
            page.waitForNavigation(),
            page.click('input[type="submit"][name="ctl00$cphContents$btnLogin"]')
        ]);
        console.log('Login successful.');
        console.log('Navigating to class search page...');
        await page.click('a[href$="search-class.aspx"]');
        console.log('On class search page.');

        // Select Gym Branch
        console.log(`Selecting gym branch: ${TARGET_GYM_BRANCH}`);
        // The site uses visible `<a>` tags to control a hidden <select>. We click the visible element.
        await page.click(`div.club-selections a:has-text("${TARGET_GYM_BRANCH}")`);
        await page.waitForLoadState('networkidle');

        // CHOOSE WEEK based on our new time logic
        if (isNextWeek(targetClassDateTime)) {
            console.log(`Class is in the next week. Clicking "Next Week".`);
            await page.click('div.schedule-selection a:has-text("下周")');
            await page.waitForLoadState('networkidle');
        } else {
            console.log('Class is in the current week.');
        }

        // Select Classroom
        console.log(`Selecting classroom: ${TARGET_CLASSROOM}`);
        await page.click(`label:has-text("${TARGET_CLASSROOM}")`);

        // Verification step: Wait for the classroom's label to be inside a 'selected' span.
        console.log('Verifying classroom selection...');
        const selectedClassroomLocator = page.locator(`span.selected label:has-text("${TARGET_CLASSROOM}")`);
        await selectedClassroomLocator.waitFor({ state: 'visible', timeout: 10000 });
        console.log('Classroom correctly selected.');

        await page.waitForLoadState('networkidle');

        // 7. FIND AND CLICK THE DESIRED CLASS
        console.log('Scrolling down to ensure the full class table is loaded...');
        await page.evaluate(() => window.scrollTo(0, 800));
        await page.waitForLoadState('networkidle'); // Wait for any scroll-triggered loads to finish


        console.log(`Searching for class: "${classToBook.name}" at ${classToBook.time}`);

        // await classRow.locator(`td:has-text("${classToBook.name}")`).first().click();
        const classTile = page.locator('a', {
            has: page.locator(`span:has-text("${classToBook.name}")`),
            hasText: classToBook.name
        })

        if (await classTile.count() === 0) {
            throw new Error(`Class "${classToBook.name}" at ${classToBook.time} not found on the schedule.`);
        }
        console.log('Class found, clicking on it to open the booking overlay...');
        classTile.first().click();


        // 8. HANDLE THE BOOKING OVERLAY (IFRAME)
        console.log('Waiting for booking overlay (iframe) to appear...');
        const bookingFrame = page.frameLocator('iframe[src*="class-info.aspx"]');

        console.log('Verifying overlay content...');
        await bookingFrame.locator(`.description .header div:has-text("${classToBook.name}")`).waitFor({ state: 'visible', timeout: 10000 });
        console.log('Overlay content verified.');

        // SCENARIO HANDLING
        const bookNowButton = bookingFrame.locator('a#ctl00_cphContents_btnBook.btn-gradient.btnLoader:has-text("現在就預訂此課")');
        const statusContainer = bookingFrame.locator('.class-info .header:last-child .right.ar');

        if (await bookNowButton.count() > 0) {
            // Scenario 1: Class is available for booking
            console.log('Status: Class is available. Clicking the booking button.');
            // UNCOMMENT THE LINE BELOW TO ACTUALLY BOOK THE CLASS
            // await bookNowButton.click();
        } else if (await statusContainer.count() > 0) {
            const statusText = await statusContainer.textContent();
            if (statusText.includes('您已預訂此課')) {
                // Scenario 4: Already booked
                console.log('Status: You have already booked this class.');
            } else if (statusText.includes('額滿')) {
                // Scenario 3: Class is full
                console.log('Status: Class is full.');
            } else if (statusText.includes('尚未開放預訂')) {
                // Scenario 2: Not yet open
                console.log(`Status: Booking is not open yet. Full message: ${statusText.trim()}`);
            } else {
                console.log(`Status: Unknown. Container text is: "${statusText.trim()}"`);
            }
        } else {
            console.log('Status: Unknown. Could not determine the booking status from the overlay.');
            // For debugging, let's see the HTML of the overlay
            const overlayHtml = await bookingFrame.locator('body').innerHTML();
            console.log('--- Overlay HTML for debugging ---');
            console.log(overlayHtml);
            console.log('---------------------------------');
        }

        console.log('---');
        console.log('✅ Automation script finished. The final booking step is commented out for safety.');
        console.log('---');

    } catch (error) {
        console.error('An error occurred:', error);
        await page.screenshot({ path: 'error_screenshot.png' });
        console.log('A screenshot has been saved as error_screenshot.png');
    } finally {
        await browser.close();
    }
})();