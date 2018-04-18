/* eslint no-console:0 */
const canvas = require('canvas-wrapper');
const cheerio = require('cheerio');
const he = require('he');
const asyncLib = require('async');
const prompt = require('prompt');
var courseId;

var imageSrc = 'Click to Define';
var yellowEyeFilename = '_image_eyeButtonYellow.jpg';
var yellowEyeFile;

/* Starts the prompt which asks the user for the course Id and then runs getStuffFromCanvas */
prompt.start();
prompt.get('CourseId', (err, result) => {
    courseId = result.CourseId;
    getStuffFromCanvas();
});

/* Retrieves the ID for the yellow eye image */
function getYellowEye(callback) {
    canvas.get(`/api/v1/courses/${courseId}/files?search_term=${yellowEyeFilename}`, (err, files) => {
        if (err) {
            callback(err);
            return;
        }
        yellowEyeFile = files[0];
        callback(null);
    });
}

/* Sends a request to Canvas to put the changed html into the course */
function updatePage(page, callback) {
    var putObject = {
        'wiki_page[body]': page.$.html()
    };
    canvas.put(`/api/v1/courses/${courseId}/pages/${page.url}`, putObject, (err, updatedPage) => {
        if (err) {
            console.log(err);
        }
        callback(null);
    });
}

/* Finds the src urls that have the wrong path and changes it to the correct path as well as adds the desired width of the src image */
function fixEyes(page) {
    var changed = false;
    page.$('img[alt="Click to Define"]').each((i, elem) => {
        if (!elem.attribs.src.includes('SessionVal')) {
            page.$(elem).attr('src', `/courses/${courseId}/files/${yellowEyeFile.id}/preview`);
            page.$(elem).attr('width', '4%');
            changed = true;
            console.log(`Page images fixed: ${page.name}`);
        }
    });
    return changed;
}

/* Retrieves the full page, including its body */
function getFullPage(page, callback) {
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
}

/* Sends a request to Canvas to get each page and their html. Calls fixEyes on each page to make desired changes */
function getStuffFromCanvas() {
    getYellowEye((err) => {
        if (err) {
            console.log(err);
        } else if (yellowEyeFile === undefined) {
            console.log('The needed file does not exist in the course.');
        } else {
            console.log(`Needed image found: ${yellowEyeFile.display_name} | ${yellowEyeFile.id}`);
            canvas.getPages(courseId, (err, pages) => {
                asyncLib.mapLimit(pages, 30, getFullPage, (err, allPages) => {
                    if (err) {
                        console.log(err);
                    } else {
                        allPages = allPages.filter(fixEyes);
                        console.log('Pages affected:', allPages.length);
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
    });
}