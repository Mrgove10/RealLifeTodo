const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer')
const fs = require('fs');
const Quote = require('inspirational-quotes');
const replace = require('replace-in-file');
var cron = require('node-cron');
require('dotenv').config();

//consts
const printerAddress = process.env.PRINTERADDRESS;
const obsidianDailyPath = process.env.OBSIDIANDAILYPATH;
const obsidianTemplatePath = process.env.OBSIDIANTEMPLATEPATH;
const events = [
    { name: "Dish Washer", startDate: "2023-07-30", frequency: "1d" },
    { name: "Sharky cleaning", startDate: "2023-07-30", frequency: "14d" },
    { name: "Bed sheet cleaning", startDate: "2023-08-06", frequency: "14d" },
    { name: "Take trash out", startDate: "2023-07-29", frequency: "5d" },
    { name: "Feed fish", startDate: "2023-07-23", frequency: "2d" },
    { name: "Clean Shower", startDate: "2023-07-23", frequency: "30d" },
    { name: "Clean Toilet", startDate: "2023-07-23", frequency: "30d" },
    { name: "Vaccum Floor", startDate: "2023-07-23", frequency: "7d" },
    { name: "Vaccum Floor", startDate: "2023-07-23", frequency: "7d" },
]

//vars
var currentDate = new Date().toISOString().split('T')[0]
var todaysFile = obsidianDailyPath + '/' + currentDate + '_test.md'
var todaysTask = [];
var todaysTaskInMarkdown = "";
var todaysQuote = null;

// Main launch
cron.schedule('30 6 * * *', () => {
    Main();
});

Main();

// Main function
function Main() {
    // Start by resetting all the variables
    todaysTask = [];
    todaysTaskInMarkdown = "";
    todaysQuote = null;

    // Apply new variables after reset
    currentDate = new Date().toISOString().split('T')[0]
    todaysFile = obsidianDailyPath + '/' + currentDate + '_test.md'
    todaysQuote = Quote.getQuote();
    events.forEach(e => {
        const result = isOccurrence(e.startDate, e.frequency);
        // console.log(getNextOccurrences(e.startDate, e.frequency, 10));
        if (result) {
            todaysTask.push(e.name);
        }
    })
    if (obsidianDailyPath !== null && obsidianDailyPath !== "" && obsidianTemplatePath !== null && obsidianTemplatePath !== "") {
        createFile();
        replaceStringsInFile()
    }
    if (todaysTask.length === 0) {
        console.log("No tasks today!");
        todaysTaskInMarkdown = "No tasks today!"
    }
    else {
        console.log("Tasks today: " + todaysTask);
        todaysTaskInMarkdown = createMarkdownChecklist(todaysTask);
        printTodaysNote(todaysQuote, todaysTaskInMarkdown);
    }
    // console.log(todaysTaskInMarkdown);

}

// Print the physical note of today
async function printTodaysNote(todaysQuote, todaysTaskInMarkdown) {
    console.log("Printing note");
    if (printerAddress === '' && printerAddress === null) {
        console.log('no printer address set');
    } else {
        console.log('Address set, printing');
        const printer = new ThermalPrinter({
            type: PrinterTypes.EPSON, // 'star' or 'epson'
            interface: printerAddress,
            options: {
                timeout: 1000,
            },
            width: 48, // Number of characters in one line - default: 48
            characterSet: CharacterSet.ISO8859_2_LATIN2, // Character set - default: SLOVENIA
            breakLine: BreakLine.WORD, // Break line after WORD or CHARACTERS. Disabled with NONE - default: WORD
            removeSpecialCharacters: false, // Removes special characters - default: false
            lineCharacter: '-', // Use custom character for drawing lines - default: -
        });

        const isConnected = await printer.isPrinterConnected();
        console.log('Printer connected:', isConnected);

        printer.alignLeft();
        printer.print(currentDate);
        printer.newLine();
        printer.print("------");
        if (todaysQuote !== null) {
            printer.newLine();
            printer.print(todaysQuote.text);
            printer.newLine();
            printer.print(todaysQuote.author);
            printer.newLine();
            printer.print("------");
        }
        if (todaysTaskInMarkdown !== "") {
            printer.newLine();
            printer.print(todaysTaskInMarkdown);
            printer.newLine();
            printer.print("------");
        }
        printer.cut();

        console.log(printer.getText());

        try {
            await printer.execute();
            console.log('Print success.');
        } catch (error) {
            console.error('Print error:', error);
        }
    }
}

// Create the file from the template
function createFile() {
    console.log("Creating file")
    fs.copyFile(obsidianTemplatePath, todaysFile, /*fs.constants.COPYFILE_EXCL,*/(err) => {
        if (err) throw err;
        console.log('FIle copied');
    });
}

// Create a markdown checklist from an array of strings
function createMarkdownChecklist(items) {
    if (!Array.isArray(items)) {
        console.error('Input is not an array.');
        return '';
    }

    if (items.length === 0) {
        console.warn('The input array is empty.');
        return '';
    }

    const checklistItems = items.map(item => `- [ ] ${item}`).join('\n');
    console.log(checklistItems)
    return checklistItems;
}

// Replace the strings in the file
function replaceStringsInFile() {
    try {
        const results = replace.sync({
            files: todaysFile,
            from: [/⚠️ This template is auto populated by #nodejs !\n/g, /¤¤DayOfWeek¤¤/g, /¤¤DailyToDo¤¤/g],
            to: ["", getDayOfWeek(), todaysTaskInMarkdown],
        });
        // console.log('Replacement results:', results);
    }

    catch (error) {
        console.error('Error occurred:', error);
    }
}

// returns true or false if today is an occurence of the event
function isOccurrence(startDate, occurrence) {
    const startDateObj = new Date(startDate);
    const occurrenceUnit = occurrence.slice(-1);
    const occurrenceValue = parseInt(occurrence.slice(0, -1));

    if (isNaN(startDateObj.getTime()) || occurrenceUnit !== 'd' || isNaN(occurrenceValue)) {
        throw new Error('Invalid input format. Expected format for startDate: "yyyy-mm-dd" and occurrence: "Xd", where X is a number.');
    }

    const today = new Date();
    const timeDiff = today.getTime() - startDateObj.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return daysDiff % occurrenceValue === 0;
}

// Get the next occurance of an event base on the start date and the frequency
function getNextOccurrences(startDate, occurrence, numOccurrences = 10) {
    const startDateObj = new Date(startDate);
    const occurrenceUnit = occurrence.slice(-1);
    const occurrenceValue = parseInt(occurrence.slice(0, -1));

    if (isNaN(startDateObj.getTime()) || occurrenceUnit !== 'd' || isNaN(occurrenceValue)) {
        throw new Error('Invalid input format. Expected format for startDate: "yyyy-mm-dd" and occurrence: "Xd", where X is a number.');
    }

    const occurrences = [];
    let currentDate = new Date(startDateObj.getTime());

    while (occurrences.length < numOccurrences) {
        currentDate.setDate(currentDate.getDate() + occurrenceValue);

        if (currentDate.getTime() > Date.now()) {
            occurrences.push(currentDate.toISOString().split('T')[0]);
        }
    }

    return occurrences;
}

// Get the day of the week
function getDayOfWeek() {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const date = new Date();
    const dayIndex = date.getDay();
    return daysOfWeek[dayIndex];
}