/* eslint no-console:0 */
const canvas = require('canvas-wrapper');
const cheerio = require('cheerio');
const he = require('he');
const asyncLib = require('async');
const prompt = require('prompt');
var courseId;

/* Starts the prompt which asks the user for the course Id and then runs getStuffFromCanvas */
prompt.start();
prompt.get('CourseId', (err, result) => {
    courseId = result.CourseId;
    getStuffFromCanvas();
});

/* Sends a request to Canvas to put the changed html into the course */
function updatePage(page, callback) {
    var putObject = {
        'wiki_page[body]': page.$.html()
    };
    canvas.put(`/api/v1/courses/${courseId}/pages/${page.url}`, putObject, (err) => {
        if (err) {
            console.log(err);
        }
        callback(null);
    });
}

/* Finds the src urls that have the wrong path and changes it to the correct path as well as adds the desired width of the src image */
function fixEyes(page) {
    page.$('img').each((i, elem) => {
        if (elem.attribs.src && elem.attribs.src.includes('Eye%20button') && !elem.attribs.src.includes('SessionVal')) {
            page.$(elem).attr('src', `https://byui.instructure.com/courses/${courseId}/file_contents/course%20files/template/gs120l_image_eyeButtonYellow.jpg`);
            page.$(elem).attr('width', '4%');
        }
    });
    return page;
}

/* Sends a request to Canvas to get each page and their html. Calls fixEyes on each page to make desired changes */
function getStuffFromCanvas() {
    canvas.getPages(courseId, (err, pages) => {
        asyncLib.mapLimit(pages, 30, (page, callback) => {
            canvas.get(`/api/v1/courses/${courseId}/pages/${page.url}`, (err, fullPage) => {
                if (err) {
                    console.log(err);
                } else {
                    fullPage = fullPage[0];
                    if (fullPage.body) {
                        fullPage.$ = cheerio.load(he.decode(fullPage.body));
                    }
                    callback(null, fullPage);
                }
            });
        }, (err, allPages) => {
            if (err) {
                console.log(err);
            } else {
                allPages = allPages.map(fixEyes);
                asyncLib.eachLimit(allPages, 30, updatePage, (err) => {
                    if (err) {
                        console.log(err);
                    }
                    console.log('Success!!');
                });
            }
        });
    });
}