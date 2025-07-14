import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
const PORT = process.env.PORT || 8080;

const LOGIN_URL = 'https://www.trueclassbooking.com.tw/member/login.aspx';
const CLASS_URL = 'https://www.trueclassbooking.com.tw/member/search-class.aspx';
const GYM_USERNAME = process.env.GYM_USERNAME;
const GYM_PASSWORD = process.env.GYM_PASSWORD;



//app.get('/run', async (req, res) => {
let browser = null;
try {
    console.log('Launching browser...');
    // Launch Puppeteer. The args are important for running in a container.
    browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // This is needed for some container environments
            '--disable-gpu'
        ]
    });

    const page = await browser.newPage();

    const searchForClass = async (page) => {
        const btnClass = await page.$('a[href$="search-class.aspx"]');

        if (btnClass) {
            console.log('Navigating to class search page...');
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }), // Wait for the page to load after login
                page.click('a[href$="search-class.aspx"]'),
            ]);

            let currentBranch = await page.$('h2');
            let branchText = await page.evaluate(el => el.textContent, currentBranch);

            if (branchText === '台北小巨蛋瑜珈健身館') {
                selectWeek(page);
            } else {
                locateBranch(page);
            }

        } else {
            console.error('Class button not found. Please check the selector.');
        }
    }

    const locateBranch = async (page) => {
        console.log('Switching to the correct branch... to be implemented');
    };

    const selectWeek = async (page) => {
        console.log('Selecting the current week...');
        let dayOfWeek = new Date().getDay();

        switch (dayOfWeek) {
            // sunday, saturday
            case 1:
            case 0:
            case 6:
                console.log(dayOfWeek, 'Move to next weeek');

                let btnWeek = await page.$('.schedule-selection a.week[rel="4"]');

                if (btnWeek) {
                    console.log('ok');
                    // await Promise.all([
                    //     page.waitForNavigation({ waitUntil: 'networkidle0' }),
                    //     page.click('.schedule-selection a.week[rel="4"]')
                    // ]);

                } else {
                    console.log('not ok');
                }
                break;

            default:
                console.log(dayOfWeek, 'Stay on the same week');
                break;
        }

    }



    console.log('Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle0' });

    // --- Login ---
    console.log('Entering credentials...');
    // Note: The selectors here are based on the website structure and may need updating if the site changes.
    await page.type('#ctl00_cphContents_txtUsername', GYM_USERNAME);
    await page.type('#ctl00_cphContents_txtPassword', GYM_PASSWORD);

    console.log('Clicking login button...');
    // We use Promise.all to wait for both the click and the subsequent navigation to complete.
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }), // Wait for the page to load after login
        page.click('#ctl00_cphContents_btnLogin'),
    ]);

    // --- Verification ---
    // Check for an element that only appears after a successful login.
    // This could be a 'Logout' button, the user's name, or the class schedule itself.
    const logoutButton = await page.$('a[href$="logout.aspx"]'); // Example selector for a logout link

    if (logoutButton) {
        console.log('Login successful. Logout button found.');
        await searchForClass(page);

        //   const pageContent = await page.content();
        //   // TODO: Add logic here to find the specific class and click the 'book' button.
        //   res.status(200).send(`<h1>Login Successful</h1><p>Next step is to find and book the class.</p><pre>${pageContent}</pre>`);
    } else {
        console.error('Login failed. Logout button not found.');
        //   const failedContent = await page.content();
        //   res.status(401).send(`<h1>Login Failed</h1><pre>${failedContent}</pre>`);
    }








} catch (error) {
    console.error('An error occurred during the automation:', error);
    // res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
} finally {
    if (browser) {
        console.log('Closing browser...');
        await browser.close();
    }
}
// });

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
