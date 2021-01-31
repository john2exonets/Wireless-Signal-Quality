//
//  DDWRT.js  --  Node.JS Module for DD-WRT APs
//
//  Get psuedo-JSON files from DD-WRT via the Web Interface.
//  https://github.com/mirror/dd-wrt/tree/master/src/router/kromo/dd-wrt
//
//  NOTE:  There are MANY different outputs that can come from the various different
//  versions of DD-WRT, even when using the same hardware!  This modules was written
//  using TP-Link AC1750, C7 versions, with the following DD-WRT versions:
//      DD-WRT v24-sp2 (08/12/10) std-usb-ftp
//      DD-WRT v3.0-r35831 std (04/26/18)
//      DD-WRT v3.0-r39296 std (03/27/19) * Most Tested version *
//
//   Depending on what mode the node is in will drive what data items are available.
//
//  John D. Allen
//  Jan 2020
//

var LIBVERSION = "0.01";
var TIMEOUT = 5000;          // timeout value in ms

var http = require('http');
var util = require('util');
const { timeStamp } = require('console');

/**
 * Constructor
 * @param {object} opts
 */
function ddwrt(opts) {
  this.debug = opts.DEBUG || 0;
  this.ipaddr = opts.IPAddr || "0.0.0.0";
  this.user = opts.User || 'admin';
  this.passwd = opts.Passwd || 'admin';
  this.connectFlag = false;
  this.ap = [];
}

var API = ddwrt.prototype;
module.exports = ddwrt;

//--------------------------------------------------------------------------
// Function: init()
//--------------------------------------------------------------------------
API.init = function() {
  if (this.debug > 9) { console.log("::init()"); }
  return new Promise((resolve,reject) => {
    if (this.ipaddr === '0.0.0.0') {
      reject("IP Address is still set to '0.0.0.0'");
    }
    this.getLANStatus().then((out) => {
      this.getWirelessStatus().then((out) => {
        this.getWANStatus().then((out) => {
          this.getRouterStatus().then((out) => {
            // Should just return "OK"
            if (this.debug > 3) { console.log(out); }
            resolve(out);
          }).catch((err) => {
            reject(err);
          });;
        }).catch((err) => {
          reject(err);
        });;
      }).catch((err) => {
        reject(err);
      });;
    }).catch((err) => {
      reject(err);
    });
  });

}

//--------------------------------------------------------------------------
// Function: isReady()
//--------------------------------------------------------------------------
API.isReady = function() {
  if (this.connectFlag) {
    return true;
  } else {
    return false;
  }
}

//--------------------------------------------------------------------------
// Function: whenReady()
//--------------------------------------------------------------------------
API.whenReady = function() {
  // @TODO: need to add timeout
  return new Promise((resolve,reject) => {
    if (this.connectFlag) {
        resolve();
    } else {
      setTimeout(this.whenReady, 1000);
    }
  });
}

//--------------------------------------------------------------------------
// Function: _restcall()
//--------------------------------------------------------------------------
/*
 * Do REST call to ddwrt AP
 * @param {string} url            -- URL to use
 */
API._restcall = function(url) {
  if (this.debug > 9) { console.log("_restcall()"); }
  return new Promise((resolve, reject) => {
    var opts = {
      'method': 'GET',
      'hostname': this.ipaddr,
      'port': 80,
      'path': [
        url
      ],
      'headers': {
        'Authorization': 'Basic ' + new Buffer(this.user + ':' + this.passwd).toString('base64'),
        'User-Agent': 'Node.JS 6.14',
        'Accept': '*/*',
        "Cache-Control": "no-cache",
        "cache-control": "no-cache"
      }
    };

    // Do the HTTP call
    if (this.debug > 8) { console.log('[--------------------------------------------------------]');}
    if (this.debug > 8) { console.log('REQ>>\n   Headers: ' + util.inspect(opts.headers,{depth: null, colors: true})); }
    if (this.debug > 8) { console.log('   Path: ' + opts.path); }
    if (this.debug > 8) { console.log('   Host: ' + opts.hostname); }

    var req = http.request(opts, function(res) {
      if (this.debug > 8) { console.log('RES>>\n   STATUS: ' + res.statusCode); }
      if (this.debug > 8) { console.log('   STATUS MSG: ' + res.statusMessage); }
      if (this.debug > 8) { console.log('   HEADERS: ' +  JSON.stringify(res.headers, null, 3)); }
      res.setEncoding('utf8');
      //var body = [];
      var pp = "";

      res.on('data', (chunk) => {
        pp += chunk.toString();
      });

      res.on('end', () => {
        if (pp.length === 0) {    // DELETE method could return a blank response
          resolve('{}');
        } else {
          //var pp = Buffer.concat(body)
          if (this.debug > 8) { console.log('BODY: ' + pp); }
          resolve(pp);
        }
      });

      res.on('abort', (err) => {
        console.log("::AbortEvent - " + err);
        reject(err);
      });
      res.on('connect', (a,b,c) => {
        console.log("::ConnectEvent");
        reject(err);
      });
      res.on('continue', () => {
        console.log("::Continue");
        reject(err);
      });
      res.on('information', (info) => {
        console.log("::info - " + info);
        reject(err);
      });

    });

    if (this.debug > 8) { console.log('[--------------------------------------------------------]');}
    req.on('socket', (sock) => {
      sock.setTimeout(TIMEOUT);
      sock.on('timeout', () => {
        req.abort();
        reject("Timeout Connecting");
      });
    });

    req.end();
    req.on('error', (err) => {
      if (err.errno == "ECONNREFUSED" && this.ipaddr == "0.0.0.0") {
        reject("IP Address still set to 0.0.0.0");
      } else {
        reject(err);
      }
    });
  });
}

//--------------------------------------------------------------------------
// Function: _parse()
//   -- Parse the output from the DD-WRT AP.  Its JSON-like, but not really :(
//--------------------------------------------------------------------------
API._parse = function(data) {
  if (this.debug > 9) { console.log("_parse()"); }
  if (this.debug > 9) { console.log("DATA:" + data); }
  return new Promise((resolve,reject) => {
    // break out key::value lines and put into temp array
    var recs = [];
    var ln = "";
    for (var i = 0; i < data.length; i++) {
      if (data[i] != "\{" && data[i] != "}") {    // not a bracket, add char to line
        ln += data[i];
      } else if (data[i] == "}") {        // if end bracket, we have the line; add to recs array
        recs.push(ln);
        ln = "";
        //
        // All data read into recs array. Start parseing into key:value Array
        //
        if (i == data.length -1) {
          if (this.debug > 9) { console.log("RECS:" + recs); }
          var rr;
          for (var j = 0; j < recs.length; j++) {   // run through recs array...
            rr = recs[j].split(/::/);
            this.putAP(rr[0], rr[1]);
            if (j == recs.length -1) {      // All done with adds/mods
              resolve("OK");
            }
          }
        }
      }
    }
  });
}

//--------------------------------------------------------------------------
// Function: getAP()    --  Return current value for passed key, if any.
//--------------------------------------------------------------------------
API.getAP = function(key) {
  return new Promise((resolve,reject) => {
    if (this.debug > 9) { console.log("::getAP()"); }
    if (this.isReady) {
      for (var i = 0; i < this.ap.length; i++) {
        if (this.ap[i].name == key) {
          resolve(this.ap[i].val);
        }
      }
    } else {
      reject("Not Ready! Besure to call init() first!");
    }
  });
}

//--------------------------------------------------------------------------
// Function: putAP()    -- Replaces/Adds value for given key
//--------------------------------------------------------------------------
API.putAP = function(key,val) {
  if (this.debug > 9) { console.log("::putAP()"); }
  if (this.ap.length == 0) {           // Array is empty; nothing to check -- just add.
    if (this.debug > 9) { console.log(">Adding First Record to AP..."); }
    this.ap.push(JSON.parse('{"name": "' + key + '", "val": "' + val + '"}'));
    return;
  }
  var flg = false;      // Flag so we don't run through small array and double add.
  for (var i = 0; i < this.ap.length; i++) {
    if (this.ap[i].name == key) {
      flg = true;
      val = val.replace(/&nbsp;/g,"");  // Remove the non-black spaces
      if (this.debug > 9) { console.log(">>>Updating Record to AP..."); }
      this.ap[i].val = val;
      return;
    }
    if (i == this.ap.length -1 && !flg) {      // hit the end of ap array...not here.
      var g = '{"name": "' + key + '", "val": "' + val + '"}';
      g = g.replace(/&nbsp;/g,"");   // Remove the non-black spaces
      if (g.indexOf('<') == -1) {     // IF there is HTML in the value, that messes up the JSON parse.
        if (this.debug > 9) { console.log(">>Adding Record to AP..."); }
        this.ap.push(JSON.parse(g));
      }
      return;
    }
  }
}

//--------------------------------------------------------------------------
// Function: dumpAP()
//--------------------------------------------------------------------------
API.dumpAP = function() {
  if (this.debug > 9) { console.log("::dumpAP()"); }
  return this.ap;
}

//--------------------------------------------------------------------------
// Function: getAPStatus()
//--------------------------------------------------------------------------
API.getAPStatus = function() {
  if (this.debug > 9) { console.log("::getAPStatus()"); }
  return new Promise((resolve,reject) => {
    if (this.isReady) {
      this._restcall("/Statusinfo.live.asp").then((out) => {
        this._parse(out).then((rr) => {
          resolve("OK");
        });
      }).catch((err) => {
        reject(err);
      });
    } else {
      reject("Not Ready! Besure to call init() first!");
    }   
  });
}

//--------------------------------------------------------------------------
// Function: getRouterStatus()
//--------------------------------------------------------------------------
API.getRouterStatus = function() {
  if (this.debug > 9) { console.log("::getRouterStatus()"); }
  return new Promise((resolve,reject) => {
    if (this.isReady) {
      this._restcall("/Status_Router.live.asp").then((out) => {
        this._parse(out).then((rr) => {
          resolve("OK");
        });
      }).catch((err) => {
        reject(err);
      });
    } else {
      reject("Not Ready! Besure to call init() first!");
    }
  });
}

//--------------------------------------------------------------------------
// Function: getLANStatus()
//--------------------------------------------------------------------------
API.getLANStatus = function() {
  if (this.debug > 9) { console.log("::getLANStatus()"); }
  return new Promise((resolve,reject) => {
    if (this.isReady) {
      this._restcall("/Status_Lan.live.asp").then((out) => {
        this._parse(out).then((rr) => {
          resolve("OK");
        });
      }).catch((err) => {
        reject(err);
      });
    } else {
      reject("Not Ready! Besure to call init() first!");
    }  
  });
}

//--------------------------------------------------------------------------
// Function: getWirelessStatus()
//--------------------------------------------------------------------------
API.getWirelessStatus = function() {
  if (this.debug > 9) { console.log("::getWirelessStatus()"); }
  return new Promise((resolve,reject) => {
    if (this.isReady) {
      this._restcall("/Status_Wireless.live.asp").then((out) => {
        this._parse(out).then((rr) => {
          resolve("OK");
        });
      }).catch((err) => {
        reject(err);
      });
    } else {
      reject("Not Ready! Besure to call init() first!");
    }
  });
}

//--------------------------------------------------------------------------
// Function: getWANStatus()
//--------------------------------------------------------------------------
API.getWANStatus = function() {
  if (this.debug > 9) { console.log("::getWANStatus()"); }
  return new Promise((resolve,reject) => {
    if (this.isReady) {
      this._restcall("/Status_Internet.live.asp").then((out) => {
        this._parse(out).then((rr) => {
          resolve("OK");
        });
      }).catch((err) => {
        reject(err);
      });
    } else {
      reject("Not Ready! Besure to call init() first!");
    }
  });
}

//---------------------------------------------------------------------------
//------------------[   Field Formatter Functions   ]------------------------
//---------------------------------------------------------------------------

API.fmtActiveWireless = function() {
  return new Promise((resolve,reject) => {
    var g;
    var aw = [];
    var aa = this.getAP("active_wireless");
    aa = aa.split(/',/);
    for (var i = 0; i < aa.length; i += 10) {
      // every 10 values is 1 wireless client.
      g = '{"mac": "' + aa[i].substr(1) + '", "int": "' + aa[i+1].substr(1)+ '", "uptime": "';
      g += aa[i+2].substr(1) + '", "txrate": "' + aa[i+3].substr(1) + '", "rxrate": "' + aa[i+4].substr(1);
      g += '", "type": "' + aa[i+5].substr(1) + '", "sig": "' + aa[i+6].substr(1) + '", "noise": "';
      g+= aa[i+7].substr(1) + '", "snr": "' + aa[i+8].substr(1) + '", "sig": "' + aa[i+9].substr(1) + '"}';
      if (this.debug > 5) { console.log(g); }
      aw.push(JSON.parse(g));
      if (i == aa.length -10) {
        resolve(aw);
      }
    }
  });
}

API.fmtARPTable = function() {
  return new Promise((resolve,reject) => {
    var g;
    var arp = []
    var aa = this.getAP("arp_table");
    aa = aa.substr(1).slice(0,-1);      // remove leading and trailing single-quote mark
    aa = aa.split(/',/);
    for (var i = 0; i < aa.length; i +=4) {
      // every 4 values is 1 ARP Table entry
      g = '{"name": "' + aa[i].substr(1) + '", "ip": "' + aa[i+1].substr(1);
      g += '", "mac": "' + aa[i+2].substr(1) + '", "conncount": ' + aa[i+3].substr(1) + '}';
      if (this.debug > 5) { console.log(g); }
      arp.push(JSON.parse(g));
      if (i == aa.length -4) {
        resolve(arp);
      }
    }
  });
}

API.fmtDHCPLeases = function() {
  return new Promise((resolve,reject) => {
    var arp = []
    var aa = this.getAP("dhcp_leases");
    aa = aa.substr(1).slice(0,-1);      // remove leading and trailing single-quote mark
    aa = aa.split(/',/);
    for (var i = 0; i < aa.length; i +=5) {
      // every 5 values is 1 DHCP Lease Table entry
      g = '{"name": "' + aa[i].substr(1) + '", "ip": "' + aa[i+1].substr(1);
      g += '", "mac": "' + aa[i+2].substr(1) + '", "leaseTime": "' + aa[i+3].substr(1);
      g += '", "num": ' + aa[i+4].substr(1) + '}';
      if (this.debug > 5) { console.log(g); }
      arp.push(JSON.parse(g));
      if (i == aa.length -5) {
        resolve(arp);
      }
    }
  })
}
