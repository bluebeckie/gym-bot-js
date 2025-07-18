# Gym Class Bot

After I quit from my last job, the frequency of gym-going went from 4 days a month to 4 days a week. Class booking is very competitive. Almost all popular classes are booked the moment it opens. Even though I have set up a reminder, sometimes I still missed the booking window. After missing several classes I came up with the idea to really start developing my class booking bot, and I need to do it "the vibe way".

## The History

### version 1
In the beginning I simply asked ChatGPT for suggestions and used the python code it provided. The arcitecture was to run it with Cloud Run. It only had the first step of logging-in and I was strugging with the deployment for a while.

### version 2
The 2nd day I asked Gemin-cli if puppeteer could be a better solution since it actually involved manipulating browser elements. It provided me with the first batch of code and I started working on it myself. I sepnt time adding code to it and verify as I went. To some point there was a bug that I needed to figure out so I called it a day.

### version 3
The third time around I finally learned to collaborate with gemini-cli. This time I consulted with it first and it suggested playwright over puppeteer. I went with it (as always). Since the whole flow involves logging in, I provided it with the link to the login page and the static HTML for the page after logged-in. It made some mistakes of hallucinating selectors that didnt exist, but was willing to admit its mistakes after being corrected (attitue is everything, no? :P). Eventually I was denied by gemini-cli with 429 but I managed to carry on the remaining tasks myself. First pari-coding with gemini-cli, it's fun! :D
