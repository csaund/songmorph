<script type="text/javascript">

var cid = 'CAMVZJD142B9182222';
var apiKey = 'WWM4H1RBU8OP0ZTQZ';
var cacheApiCalls = true;

var curSongIndex = 0;
var curPlaylist = [];
var remixer;
var masterDriver = null;
var masterPlayer;
var slavePlayer;
var curSongTime;
var curSegueTime;

var playTime = 20;
var segueTime = 10;

var npGauge;
var mixGauge;
var beatGauge;

function info(s) {
    $("#info").text(s);
}

function error(s) {
    if (s.length == 0) {
        $("#error").hide();
    } else {
        $("#error").text(s);
        $("#error").show();
    }
}


function loadTrack(song, trid) {
    fetchAnalysis(song, trid);
}


function shutItAllDown() {
    if (masterPlayer) {
        masterPlayer.stop();
        masterPlayer.setGain(1)
        $("#cur-artist").text("");
        $("#cur-title").text("");
        $("#next-artist").text("");
        $("#next-title").text("");
    }
    masterDriver = null;
}



function trackReady(t) {
    var driver = Driver(t);
    if (masterDriver == null) {
        driver.setMaster(true);
        masterDriver.start();
    } else {
        driver.setMaster(false);
        masterDriver.setSlave(driver);
    }
}


function findBestTrackTimes(t) {
    var best = 1000000;
    var bestIndex = 0;

    for (var i = 0; i < t.analysis.beats.length; i++) {
        var duration = 0;
        var qlist = [];
        var good = false;

        for (j = i; j < t.analysis.beats.length; j++) {
            var q = t.analysis.beats[j];
            duration += q.duration;
            qlist.push(q);
            if (duration > 1.0 * curSongTime + curSegueTime) {
                good = true;
                break
            }
        }

        if (good) {
            deviation = getDeviation(qlist);
            if (deviation < best) {
                best = deviation;
                bestIndex = i;
            }
        }
    }
    t.firstBeat  = t.analysis.beats[bestIndex];
}


function getDeviation(qlist) {
    var sum = 0;
    _.each(qlist, function(q) {
        sum += q.duration;
    });

    var avg = sum / qlist.length;
    var ss = 0;

    _.each(qlist, function(q) {
        var delta = q.duration - avg;
        ss += delta * delta;
    });
    return ss / qlist.length;
}

function getSum(qlist) {
    var sum = 0;
    _.each(qlist, function(q) {
        sum += q.duration;
    });
    return sum;
}

function getLoudness(beat) {
    if ('oseg' in beat) {
        return 60 + beat.oseg.loudness_max;
    } else {
        return 0;
    }
}


function readyToPlay(t) {
    if (t.status === 'ok') {
        trackReady(t);
        info("ready!");
    } else {
        info(t.status);
    }
}

function gotTheAnalysis(song, profile) {
    var status = get_status(profile);
    if (status == 'complete') {
        info("Loading track ...");
        $("#next-tempo-gauge").hide();
        //$("#loading-gauge").show();
        remixer.remixTrack(profile.response.track, function(state, t, percent) {
            track = t;
            if (state == 1) {
                info("song is loaded.");
                t.song = song;
                findBestTrackTimes(t);
                setTimeout( function() { readyToPlay(t); }, 10);
                //$("#next-tempo-gauge").show();
                //$("#loading-gauge").hide();
            } else if (state == 0) {
                loadingGauge.refresh(percent);
                if (percent >= 99) {
                    info("Here we go ...");
                } else {
                    info( percent  + "% of track loaded ");
                }
            } else {
                info('Trouble  ' + t.status);
                loadNextSong();
            }
        });
    } else if (status == 'error') {
        info("Sorry, couldn't analyze that track");
    }
}


function fetchAnalysis(song, trid) {
    var url = 'http://static.echonest.com/infinite_jukebox_data/' + trid + '.json';
    info('Fetching the analysis');
    // showPlotPage(trid);
    $.getJSON(url, function(data) { gotTheAnalysis(song, data); } )
        .error( function() { 
            info("Sorry, can't find info for that track");
        });
}

function get_status(data) {
    if (data.response.status.code == 0) {
        return data.response.track.status;
    } else {
        return 'error';
    }
}

function getAudioContext() {
    if (window.webkitAudioContext) {
        return new webkitAudioContext();
    } else {
        return new AudioContext();
    }
}

function now() {
    return new Date().getTime();
}

function cacheBuster() {
    if (!cacheApiCalls) {
        return now;
    } else {
        return 1;
    }
}

function startRadio(seedArtist) {
    shutItAllDown();
    info("Getting playlist based upon " + seedArtist);
    error('');
    var url = 'http://developer.echonest.com/api/v4/' + 'playlist/static';
    $.getJSON(url, {
        api_key:apiKey,
        type:'catalog',
        artist:seedArtist,
        seed_catalog:cid,
        min_tempo:110,
        min_energy:.4,
        adventurousness:0,
        distribution:'focused',
        results:30,
        sort:'tempo-asc',
        bucket:['audio_summary', 'id:' + cid, 'tracks'],
        limit:true,
        _:cacheBuster()
    }, 
    function(data) {
        info("Got the playlist ...");
        var response = data['response'];
        var songs = response['songs'];
        curPlaylist = songs;
        curSongIndex = 0;
        loadNextSong();
    }, 

    function () {
        error("Trouble getting music for that artist");
    }
    );
}

function loadNextSong() {
    if (curSongIndex < curPlaylist.length) { 
        var curSong = curPlaylist[curSongIndex++];
        info('Loading ...' + curSong.title + ' by ' + curSong.artist_name);
        var trid = curSong.foreign_ids[0].foreign_id.split(':')[2];
        loadTrack(curSong, trid);
        return true
    } else {
        return false;
    }
}


function go() {
    var seedArtist = $("#seed-artist").val();
    document.location = "?seed_artist=" + seedArtist;
}

function goUrl() {
    var seedArtist = $("#seed-artist").val();
    if (masterDriver) {
        masterDriver.stop();
        masterDriver = null;
    }
    curSongTime = parseInt(playTime);
    curSegueTime = parseInt(segueTime);
    startRadio(seedArtist);
}

function urldecode(str) {
   return decodeURIComponent((str+'').replace(/\+/g, '%20'));
}

function processParams() {
    var params = {};
    var q = document.URL.split('?')[1];
    if(q != undefined){
        q = q.split('&');
        for(var i = 0; i < q.length; i++){
            var pv = q[i].split('=');
            var p = pv[0];
            var v = pv[1];
            params[p] = v;
        }
    }

    if ('seed_artist' in params) {
        var seedArtist = urldecode(params['seed_artist']);
        $("#seed-artist").val(seedArtist);
        goUrl();
    }
}


function initUI()  {

    $("#go-radio").click( function() {
        go();
    });

    $("#seed-artist").change(function() {
        go();
    });

    $("#pause-play").hide();
    $("#pause-play").click(
        function() {
            if (masterDriver) {
                if (masterDriver.isRunning()) {
                    masterDriver.stop();
                } else {
                    masterDriver.start();
                }
            }
        }
    );

    $('#cur-title').on('webkitAnimationEnd mozAnimationEnd oAnimationEnd animationEnd',
        function() {
            $("#cur-title").removeClass('animated bounceInRight');
        });

    $('#next-title').on('webkitAnimationEnd mozAnimationEnd oAnimationEnd animationEnd',
        function() {
            $("#next-title").removeClass('animated bounceInRight');
        });


    npGauge = new JustGage({
        id: "cur-tempo-gauge",
        value: 120,
        min:100,
        max:150,
        title: "Tempo"
    });

    mixGauge = new JustGage({
        id: "mix-gauge",
        value: 100,
        min:0,
        max:100,
        refreshAnimationTime: 300,
        levelColors:  [ "#d7a90b", "#C8F902", "#00FF00" ],
        title: "Mix"
    });
    


    beatGauge = new JustGage({
        id: "beat-gauge",
        value: 100,
        min:0,
        max:100,
        refreshAnimationTime: 300,
        title: "Beats",
    });

    /*
    nextGauge = new JustGage({
        id: "next-tempo-gauge",
        value: 120,
        min:100,
        max:150,
        title: "Next Tempo"
    });
    */

    loadingGauge= new JustGage({
        id: "loading-gauge",
        value: 0,
        min:0,
        max:100,
        refreshAnimationTime: 3000,
        levelColors:  [ "#d7a90b", "#C8F902", "#00FF00" ],
        title: "Next Track Status"
    });

}

function windowHidden() {
    return document.webkitHidden;
}


function init() {
    jQuery.ajaxSettings.traditional = true;  

    if (window.webkitAudioContext === undefined && window.AudioContext === undefined) {
        error("Sorry, this app needs advanced web audio. Your browser doesn't"
            + " support it. Try the latest version of Chrome, Firefox (nightly)  or Safari");

        hideAll();

    } else {
        initUI();
        var context = getAudioContext();
        remixer = createJRemixer(context, $);
        masterPlayer = remixer.getPlayer();
        slavePlayer = remixer.getPlayer();
        processParams();
    }
}

function ngain(g) {
    var g = 1 - g;
    g = g * g;
    return 1 - g;
}

function Driver(track) {
    var curQ = track.firstBeat;
    var isMaster = false;
    var slave = null;
    var isRunning = false;
    var beatCount = 0;
    var totTime = 0;
    var transitionBeats = 0;
    var curTransitionBeat = 0;
    var periodDelta = 0;
    var nextTime = 0;
    var lateCounter = 0;
    var lateLimit = 4;
    var earlyTime = .020;

    // states:
    //  intro, loading, ready-for-transition, transitioning, done, no more
    var state = 'intro';

    function stop () {
        if (isMaster) {
            masterPlayer.stop();
            isRunning = false;
        }
    }

    function releaseTrack() {
        track.buffer = null;
        track.song = null;
        track.analysis = null;
    }

    function next() {
        var q = curQ;
        curQ = curQ.next;

        if (curQ == null) {
            curQ = track.firstBeat;
        }
        return q;
    }


    function process() {
        beatCount += 1;
        var q = next();

        // waitTime if positve, represents how early we are
        
        var waitTime = nextTime - masterPlayer.curTime();

        if (waitTime < 0) {
            if (lateCounter++ > lateLimit && windowHidden()) {
                error("Sorry, can't play music properly in the background. Try running in a separate window");
                interface.stop();
                return;
            } 
        } else {
            lateCounter = 0;
        }

        if (waitTime < 0) {
            waitTime = 0;
        }

        var nextDuration = masterPlayer.play(waitTime, q);
        nextTime = nextDuration + waitTime + masterPlayer.curTime();
        var nextDelay = (nextDuration + waitTime) - earlyTime;

        setTimeout( function () { 
            if (isRunning) {
                process(); 
            }
        }, 1000 * nextDelay);

        beatGauge.refresh(beatCount);

        if (beatCount > 2 && state === 'intro') {
            if (loadNextSong()) {
                state = 'loading';
            } else {
                state = 'no more';
            }
        }

        if (slave && state === 'ready-for-transition' && totTime >= curSongTime - curSegueTime) {
            state = 'transitioning';

            // see if the new song has good data
            if (slave.curQ() === undefined) {
                state = 'intro';
                if (loadNextSong()) {
                    state = 'loading';
                } else {
                    state = 'no more';
                }
            } else {
                var periodDifference = slave.curQ().duration - q.duration;
                transitionBeats = Math.round(curSegueTime / q.duration);
                periodDelta = periodDifference / transitionBeats;
                curTransitionBeat = 0;
            }
        }

        if (slave && state === 'transitioning') {
            var slaveVolume = curTransitionBeat / transitionBeats;
            var masterVolume = 1 - slaveVolume;
            var masterTempoFactor = (q.duration + periodDelta * curTransitionBeat) / q.duration

            masterPlayer.setGain(ngain(masterVolume));
            slavePlayer.setGain(ngain(slaveVolume));
            mixGauge.refresh(Math.round(slaveVolume * 100));


            masterPlayer.setSpeedFactor(masterTempoFactor);
            npGauge.refresh(Math.round(track.audio_summary.tempo / masterTempoFactor));
            var slaveDelay = slavePlayer.play(waitTime, slave.next());

            if (curTransitionBeat++ >= transitionBeats) {
                stop();
                releaseTrack();
                slave.setMaster(true);
                masterPlayer.setSpeedFactor(1);
                slavePlayer.setSpeedFactor(1);
                slave.start(nextDuration + waitTime);
                var swap = slavePlayer;
                slavePlayer = masterPlayer;
                masterPlayer = swap;
                mixGauge.refresh(0);
            }
        }

        totTime += nextDuration;
    }

    var interface = {
        start: function(delay) {
            lateCounter = 0;
            setTimeout( function () { 
                isRunning = true;
                process(); 
            }, 1000 * (delay - earlyTime));
            $("#pause-play").show();
            $("#pause-play").text('Pause');
            error('');
        },

        stop: function() {
            if (isMaster) {
                isRunning = false;
                masterPlayer.stop();
                $("#pause-play").show();
                $("#pause-play").text('Play');
            }
        },

        isRunning: function() {
            return isRunning;
        },

        next: function() {
            return next();
        },

        curQ: function() {
            return curQ;
        },

        process: function() {
            process();
        },

        setMaster: function(master) {
            isMaster = master;
            if (isMaster) {
                if (masterDriver && masterDriver.isRunning()) {
                    masterDriver.stop();
                }
                masterDriver = this;
                this.state = 'intro';
                $("#cur-artist").text(track.song.artist_name);
                $("#cur-title").text(track.song.title);
                $("#cur-title").addClass('animated bounceInRight');

                npGauge.refresh(Math.round(track.audio_summary.tempo));

                $("#next-artist").text("");
                $("#next-title").text("");
            } else {
                $("#next-artist").text(track.song.artist_name);
                $("#next-title").text(track.song.title);
                $("#next-title").addClass('animated bounceInRight');
            }
        },

        setSlave: function(theSlave) {
            slave = theSlave;
            state = 'ready-for-transition';
        }
    }

    return interface;
}

$(document).ready(function() {
    init();
});


function ga_track(page, action, id) {
    _gaq.push(['_trackEvent', page, action, id]);
}
</script>
