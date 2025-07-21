import { chromium } from 'playwright';
import 'dotenv/config';

// --- CONFIGURATION ---
const TARGET_GYM_BRANCH = '台北小巨蛋瑜珈健身館';

interface ClassInfo {
    day: '周一' | '周二' | '周三' | '周四' | '周五' | '周六' | '周日';
    name: string;
    time: string;
    classroom: string;
}

const CLASS_SCHEDULE: ClassInfo[] = [
    { day: '周二', name: 'BODYCOMBAT™  戰鬥有氧 (M)', time: '12:10', classroom: '小巨蛋A教室' },
    { day: '周六', name: 'BODYCOMBAT™  戰鬥有氧 (M)', time: '02:45', classroom: '小巨蛋A教室' },
    { day: '周日', name: 'BODYJAM™ 潮流舞蹈  (M)', time: '01:30', classroom: '小巨蛋A教室' },
];

// --- TIME-BASED HELPER FUNCTIONS ---

// Maps Chinese day names to JavaScript's day-of-the-week number (Sunday=0)
const dayNameToNumber: { [key: string]: number } = { '周日': 0, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6 };

/**
 * Calculates the exact Date object for the next occurrence of a class.
 * @param {ClassInfo} classInfo - The class schedule item.
 * @returns {Date} The full Date object for the next class session.
 */
function getNextClassDateTime(classInfo: ClassInfo): Date {
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
 * assuming the week starts on Monday and ends on Sunday.
 * @param {Date} classDate - The date of the class to check.
 * @returns {boolean} - True if the class is in the next calendar week.
 */
function isNextWeek(classDate: Date): boolean {
    const now = new Date();

    // Find the Monday of the current week.
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysToSubtractForMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const mondayOfThisWeek = new Date(now);
    mondayOfThisWeek.setDate(now.getDate() - daysToSubtractForMonday);
    mondayOfThisWeek.setHours(0, 0, 0, 0); // Set to beginning of the day

    // Find the Sunday of the current week.
    const sundayOfThisWeek = new Date(mondayOfThisWeek);
    sundayOfThisWeek.setDate(mondayOfThisWeek.getDate() + 6);
    sundayOfThisWeek.setHours(23, 59, 59, 999); // Set to end of the day

    // Since getNextClassDateTime always returns a future date, we only need to check
    // if the class is scheduled for after the end of this week (after Sunday).
    return classDate.getTime() > sundayOfThisWeek.getTime();
}


(async () => {
    const now = new Date();
    let classToBook: ClassInfo | null = null;
    let targetClassDateTime: Date | null = null;

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

    if (!classToBook || !targetClassDateTime) {
        console.log('No classes are within their booking window right now. Exiting.');
        return;
    }

    console.log('---');
    console.log(`Action: Booking window is open for "${classToBook.name}" at ${classToBook.time}.`);
    console.log('---');

    // --- START AUTOMATION ---
    const { USERNAME, PASSWORD, LOGIN_URL } = process.env;
    if (!USERNAME || !PASSWORD || !LOGIN_URL) {
        console.error('Error: Please create a .env file and add your USERNAME, PASSWORD, and LOGIN_URL.');
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
        console.log(`Selecting classroom: ${classToBook.classroom}`);
        await page.click(`label:has-text("${classToBook.classroom}")`);

        // Verification step: Wait for the classroom's label to be inside a 'selected' span.
        console.log('Verifying classroom selection...');
        const selectedClassroomLocator = page.locator(`span.selected label:has-text("${classToBook.classroom}")`);
        await selectedClassroomLocator.waitFor({ state: 'visible', timeout: 10000 });
        console.log('Classroom correctly selected.');

        await page.waitForLoadState('networkidle');

        // 7. FIND AND CLICK THE DESIRED CLASS
        console.log('Scrolling down to ensure the full class table is loaded...');
        await page.evaluate(() => window.scrollTo(0, 800));
        await page.waitForLoadState('networkidle'); // Wait for any scroll-triggered loads to finish


        console.log(`Searching for class: "${classToBook.name}" at ${classToBook.time}`);

        // The website displays a grid of 7 days, starting with Monday. We need to find the correct day's container.
        const dayToIndex = { '周一': 0, '周二': 1, '周三': 2, '周四': 3, '周五': 4, '周六': 5, '周日': 6 };
        const scheduleIndex = dayToIndex[classToBook.day];
        const dayScheduleContainer = page.locator('td.studio-schedule').nth(scheduleIndex);

        const classTile = dayScheduleContainer.locator('a').filter({
            hasText: classToBook.name
        }).filter({
            hasText: classToBook.time
        });

        if (await classTile.count() === 0) {
            throw new Error(`Class "${classToBook.name}" at ${classToBook.time} not found in the correct day's schedule.`);
        }
        console.log('Class found, clicking on it to open the booking overlay...');
        await classTile.first().click();


        // 8. HANDLE THE BOOKING OVERLAY (IFRAME)
        console.log('Waiting for booking overlay (iframe) to appear...');
        const bookingFrame = page.frameLocator('iframe[src*="class-info.aspx"]');

        console.log('Verifying overlay content...');
        await bookingFrame.locator(`.description .header div:has-text("${classToBook.name}")`).waitFor({ state: 'visible', timeout: 10000 });
        console.log('Overlay content verified.');

        // SCENARIO HANDLING
        const bookNowButton = bookingFrame.locator('a#ctl00_cphContents_btnBook.btn-gradient.btnLoader:has-text("現在就預訂此課")');
        const statusContainer = bookingFrame.locator('.class-info .header').nth(1).locator('.right.ar');

        if (await bookNowButton.count() > 0) {
            // Scenario 1: Class is available for booking
            console.log('Status: Class is available. Clicking the booking button.');
            // UNCOMMENT THE LINE BELOW TO ACTUALLY BOOK THE CLASS
            // await bookNowButton.click();
        } else if (await statusContainer.count() > 0) {
            const statusText = await statusContainer.textContent();
            if (statusText && statusText.includes('預訂開始日期:')) {
                // Scenario 4: Already booked
                console.log('Status: You have already booked this class.');
            } else if (statusText && statusText.includes('此課程已無空缺！')) {
                // Scenario 3: Class is full
                console.log('Status: Class is full.');
            } else if (statusText && statusText.includes('尚未開放預訂')) {
                // Scenario 2: Not yet open
                console.log(`Status: Booking is not open yet. Full message: ${statusText.trim()}`);
            } else {
                console.log(`Status: Unknown. Container text is: "${statusText ? statusText.trim() : 'empty'}"`);
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