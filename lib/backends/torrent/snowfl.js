const webdriver = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const html = require('node-html-parser');

//options.setBinary('');
//const binary = new firefox.Binary('/usr/bin/firefox');
//binary.addArguments("--headless");
const options =  new firefox.Options();
//options.addArguments("--headless");
//options.setPreference("useAutomationExtension", false);
//options.setPreference("dom.webdriver.enabled", false);
options.setPreference("general.useragent.override", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.42");

module.exports = async function (search) {
  var torrents = [];

  let driver = new webdriver.Builder()
    .forBrowser(webdriver.Browser.FIREFOX)
    .setFirefoxOptions(options)
    .build();
    
  try {
    await driver.get('https://snowfl.com/');
    await driver.wait(webdriver.until.elementLocated(webdriver.By.id("query")), 5000);
    await driver.findElement(webdriver.By.id("query")).sendKeys(search + webdriver.Key.ENTER);
    await driver.wait(webdriver.until.elementLocated(webdriver.By.css('#results > .result-item')), 20000);
    
    //console.log(await driver.getPageSource());
    const elements = await driver.findElements(webdriver.By.css('#results > .result-item'));
    for (const element of elements) {
      const elementSource = await element.getAttribute("innerHTML");
      const elementParsed = html.parse(elementSource);
      var name = elementParsed.querySelector(".name").text;
      var nameSplit = name.split(" ");
      nameSplit.shift();
      name = nameSplit.join(" ");
      var seed = elementParsed.querySelector(".seed").text;
      var leech = elementParsed.querySelector(".leech").text;
      var size = elementParsed.querySelector(".size").text;
      var source = elementSource.match("site: (.*?)•")[0].replaceAll("site: ", "").replaceAll(" •", "");
      var sourceName, sourceURL;
      if(source.startsWith("<a ")) {
        var sourceParsed = html.parse(source);
        sourceURL = sourceParsed.getAttribute("href");
        sourceName = sourceParsed.text;
      } else {
        sourceName = source;
        sourceURL = "not found";
      }
      var torrentURL = elementParsed.querySelector(".torrent").getAttribute("href");
      var age = elementParsed.querySelector(".age").text;
      var category = elementParsed.querySelector(".category").text;

      var torrent = {
        name: name,
        seed: seed,
        leech: leech,
        size: size,
        sourceName: sourceName,
        sourceURL: sourceURL,
        torrentURL: torrentURL,
        age: age,
        category: category
      };
      torrents.push(torrent);
    }
  } catch(e) {
    torrents = null;
  } finally {
    await driver.quit();
  }

  return torrents;
};