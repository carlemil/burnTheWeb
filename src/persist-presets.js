  // ---- presets: named full-scene snapshots (effect + all its settings) ----
  function snapshotScene() {
    saveState(effect); saveBeat(effect); savePulse(effect); savePlen(effect); saveExtra(effect);
    return {
      effect,
      state: JSON.parse(JSON.stringify(states[effect])),
      beat: JSON.parse(JSON.stringify(beatStates[effect])),
      pulse: JSON.parse(JSON.stringify(pulseStates[effect])),
      plen: JSON.parse(JSON.stringify(plenStates[effect])),
      // beatTune + ranges are globals, remembered per preset so a scene is a COMPLETE copy of
      // what is on screen — the point of the exercise, since a preset is now something you hand
      // to someone else. beatTune: different thresholds mean different beats mean a different
      // animation. ranges: a value outside the recipient's slider bounds is silently clamped by
      // the DOM, so a preset authored with a widened bound would quietly animate differently.
      // The camera is NOT a preset-root field: it is per-layer state, riding inline in this
      // top-level `state` (the single/selected effect) and in each layer's own `cam` node.
      sceneFx: readSceneFx(),         // the scene-global Scene filters travel with the preset
      beatTune: collectBeatTune(),
      ranges: sceneRanges(),
      // Scene TTL and Transition are NOT here: they are purely GLOBAL, kept once in
      // fullSnapshot beside auto-cycle and the resolution. They were per-preset for a while, so
      // a shared scene played with the pacing it was authored with — but the cost was that
      // selecting any scene silently retuned your TTL and transition length underneath you, and
      // those are the SHOW's pacing rather than any one scene's. A preset saved during that
      // period still carries `ttl`/`tdur`; both are simply ignored now.
      extra: JSON.parse(JSON.stringify(extras[effect])),
      // Null (and dropped by JSON) whenever the stack holds one item, so a non-stacked
      // preset is exactly the shape it has always been.
      layers: stackOut(),
    };
  }
  // The library a first-time visitor gets, and what an emptied one is re-seeded with.
  // TWO hand-authored scenes rather than one per effect: twenty machine-named scenes is a
  // list to wade through, and the opening should look like something instead. Both were
  // authored in the app and lifted from the published profiles they live in — Fetingen from
  // dyze, Round and round from Erbsman — with `collection` stripped, so a new visitor sees
  // them as their own scenes rather than as somebody else's collection.
  function defaultPresets() {
    const lib = deserializeBlob({ presets: DEFAULT_LIBRARY }).presets;
    // deserializeBlob drops any scene naming an effect this build no longer ships. If that
    // took the lot, fall back to one per effect: an empty library would break the
    // "something is always selected" invariant before ensureSelection could repair it.
    return lib.length ? lib : perEffectPresets();
  }
  // The scenes above, in the WIRE FORMAT (effect ids, not indices), so they survive a
  // registry reorder exactly like any saved scene does. Every map is kept WHOLE rather than
  // pruned to deltas: pruning `beat` against all-false is the trap the share codec documents
  // — it is only sound while no descriptor arms a chip — and this is source, where the bytes
  // cost nothing to be safe with. Re-export from the app and paste over to change them.
  const DEFAULT_LIBRARY = [{"name":"Fetingen","effect":"sirpinfyer","state":{"rise":[105,200],"burn":[120,120],"fade":[0.94,0.94],"diffuse":[1,1],"diffkeep":[0.97,0.97],"echo":[2,2],"echoang":[90,90],"echokeep":[0.94,0.94],"zfb":[1.02,1.02],"zfbkeep":[0.94,0.94],"swirl":[2,2],"swirlkeep":[0.989619565217391,0.995],"twist":[1.2,1.2],"wedgeseg":[6,6],"wedgerot":[0,0],"glitch":[0.05,0.05],"glitchrows":[8,8],"pixel":[6,6],"soften":[-0.6,-0.6],"softrad":[1.5,1.5],"edge":[0.7,0.7],"poster":[5,5],"halfdot":[4,4],"halfamt":[0.8,0.8],"threshlvl":[0.5,0.5],"threshamt":[0.8,0.8],"chroma":[1,1],"mirror":[1,1],"bloom":[0.35,0.35],"barrel":[0.15,0.15],"scan":[0.35,0.35],"scancount":[240,240],"vignette":[0.4,0.4],"grain":[0.08,0.08],"camrx":[0,0],"camry":[0,76.304347826087],"camrz":[0,0],"heatboost":[0,0],"palcycle":[0,10.6508875739645],"palhold":[0,0],"band":[0,0],"bandsize":[1,1],"banddim":[0,0],"speed":[20,211.538461538462],"zoom":[0.997041420118343,1.375],"size":[1,1],"rot":[0,0],"layers":3,"rpm":[0.03,0.15],"ratio":[21.5,21.5],"inrad":[0.03,0.03],"outrad":[1.05,1.05],"phase":[0,0],"points":[6411.41304347826,8000]},"beat":{"boxsize":{"low":false,"mid":false,"high":false},"points":{"low":false,"mid":false,"high":false},"speed":{"low":true,"mid":false,"high":false},"size":{"low":false,"mid":false,"high":false},"rot":{"low":false,"mid":false,"high":false},"nod":{"low":false,"mid":false,"high":false},"nodspd":{"low":false,"mid":false,"high":false},"sway":{"low":false,"mid":false,"high":false},"rpm":{"low":false,"mid":false,"high":false},"ratio":{"low":false,"mid":false,"high":false},"inrad":{"low":false,"mid":false,"high":false},"outrad":{"low":false,"mid":false,"high":false},"phase":{"low":false,"mid":false,"high":false},"cardx":{"low":false,"mid":false,"high":false},"pspeed":{"low":false,"mid":false,"high":false},"pscale":{"low":false,"mid":false,"high":false},"pwarp":{"low":false,"mid":false,"high":false},"tunspeed":{"low":false,"mid":false,"high":false},"tuntwist":{"low":false,"mid":false,"high":false},"tunrings":{"low":false,"mid":false,"high":false},"mbcount":{"low":false,"mid":false,"high":false},"mbradius":{"low":false,"mid":false,"high":false},"mbspeed":{"low":false,"mid":false,"high":false},"mbgain":{"low":false,"mid":false,"high":false},"ksegments":{"low":false,"mid":false,"high":false},"krotspeed":{"low":false,"mid":false,"high":false},"knoisespeed":{"low":false,"mid":false,"high":false},"rzrot":{"low":false,"mid":false,"high":false},"rzzoom":{"low":false,"mid":false,"high":false},"rztile":{"low":false,"mid":false,"high":false},"xorspeed":{"low":false,"mid":false,"high":false},"xorscale":{"low":false,"mid":false,"high":false},"xormask":{"low":false,"mid":false,"high":false},"mofreq":{"low":false,"mid":false,"high":false},"modrift":{"low":false,"mid":false,"high":false},"momix":{"low":false,"mid":false,"high":false},"nwspin":{"low":false,"mid":false,"high":false},"nwrelax":{"low":false,"mid":false,"high":false},"mbexp":{"low":false,"mid":false,"high":false},"cbcount":{"low":false,"mid":false,"high":false},"cbspeed":{"low":false,"mid":false,"high":false},"cbwidth":{"low":false,"mid":false,"high":false},"pgsides":{"low":false,"mid":false,"high":false},"pgrad":{"low":false,"mid":false,"high":false},"pgthick":{"low":false,"mid":false,"high":false},"pgspin":{"low":false,"mid":false,"high":false},"sgcells":{"low":false,"mid":false,"high":false},"sgdot":{"low":false,"mid":false,"high":false},"sgsquare":{"low":false,"mid":false,"high":false},"sgpulse":{"low":false,"mid":false,"high":false},"sgspeed":{"low":false,"mid":false,"high":false},"cosides":{"low":false,"mid":false,"high":false},"cocount":{"low":false,"mid":false,"high":false},"cothick":{"low":false,"mid":false,"high":false},"cospeed":{"low":false,"mid":false,"high":false},"cospin":{"low":false,"mid":false,"high":false},"bncount":{"low":false,"mid":false,"high":false},"bnrad":{"low":false,"mid":false,"high":false},"bnsquare":{"low":false,"mid":false,"high":false},"bnspeed":{"low":false,"mid":false,"high":false},"sdcount":{"low":false,"mid":false,"high":false},"sdsize":{"low":false,"mid":false,"high":false},"sdmix":{"low":false,"mid":false,"high":false},"sdspeed":{"low":false,"mid":false,"high":false},"sdspin":{"low":false,"mid":false,"high":false},"sdrim":{"low":false,"mid":false,"high":false},"ata":{"low":false,"mid":false,"high":false},"atb":{"low":false,"mid":false,"high":false},"atc":{"low":false,"mid":false,"high":false},"atd":{"low":false,"mid":false,"high":false},"atjit":{"low":false,"mid":false,"high":false},"zoom":{"low":false,"mid":true,"high":false},"camrx":{"low":false,"mid":false,"high":false},"camry":{"low":false,"mid":false,"high":false},"camrz":{"low":false,"mid":false,"high":false},"palcycle":{"low":false,"mid":false,"high":false},"heatboost":{"low":false,"mid":false,"high":false},"rise":{"low":false,"mid":false,"high":false},"burn":{"low":false,"mid":false,"high":false},"fade":{"low":false,"mid":false,"high":false},"diffuse":{"low":false,"mid":false,"high":false},"diffkeep":{"low":false,"mid":false,"high":false},"echo":{"low":false,"mid":false,"high":false},"echoang":{"low":false,"mid":false,"high":false},"echokeep":{"low":false,"mid":false,"high":false},"zfb":{"low":false,"mid":false,"high":false},"zfbkeep":{"low":false,"mid":false,"high":false},"swirl":{"low":false,"mid":false,"high":false},"swirlkeep":{"low":false,"mid":false,"high":false},"twist":{"low":false,"mid":false,"high":false},"wedgeseg":{"low":false,"mid":false,"high":false},"wedgerot":{"low":false,"mid":false,"high":false},"glitch":{"low":false,"mid":false,"high":false},"glitchrows":{"low":false,"mid":false,"high":false},"pixel":{"low":false,"mid":false,"high":false},"soften":{"low":false,"mid":false,"high":false},"softrad":{"low":false,"mid":false,"high":false},"edge":{"low":false,"mid":false,"high":false},"poster":{"low":false,"mid":false,"high":false},"halfdot":{"low":false,"mid":false,"high":false},"halfamt":{"low":false,"mid":false,"high":false},"threshlvl":{"low":false,"mid":false,"high":false},"threshamt":{"low":false,"mid":false,"high":false},"chroma":{"low":false,"mid":false,"high":false},"mirror":{"low":false,"mid":false,"high":false},"bloom":{"low":false,"mid":false,"high":false},"barrel":{"low":false,"mid":false,"high":false},"scan":{"low":false,"mid":false,"high":false},"scancount":{"low":false,"mid":false,"high":false},"vignette":{"low":false,"mid":false,"high":false},"grain":{"low":false,"mid":false,"high":false},"band":{"low":false,"mid":false,"high":false},"bandsize":{"low":false,"mid":false,"high":false},"banddim":{"low":false,"mid":false,"high":false}},"pulse":{"boxsize":"snap","points":"snap","speed":"snap","size":"snap","rot":"snap","nod":"snap","nodspd":"snap","sway":"snap","rpm":"snap","ratio":"snap","inrad":"snap","outrad":"snap","phase":"snap","cardx":"snap","pspeed":"snap","pscale":"snap","pwarp":"snap","tunspeed":"snap","tuntwist":"snap","tunrings":"snap","mbcount":"snap","mbradius":"snap","mbspeed":"snap","mbgain":"snap","ksegments":"snap","krotspeed":"snap","knoisespeed":"snap","rzrot":"snap","rzzoom":"snap","rztile":"snap","xorspeed":"snap","xorscale":"snap","xormask":"snap","mofreq":"snap","modrift":"snap","momix":"snap","nwspin":"snap","nwrelax":"snap","mbexp":"snap","cbcount":"snap","cbspeed":"snap","cbwidth":"snap","pgsides":"snap","pgrad":"snap","pgthick":"snap","pgspin":"snap","sgcells":"snap","sgdot":"snap","sgsquare":"snap","sgpulse":"snap","sgspeed":"snap","cosides":"snap","cocount":"snap","cothick":"snap","cospeed":"snap","cospin":"snap","bncount":"snap","bnrad":"snap","bnsquare":"snap","bnspeed":"snap","sdcount":"snap","sdsize":"snap","sdmix":"snap","sdspeed":"snap","sdspin":"snap","sdrim":"snap","ata":"snap","atb":"snap","atc":"snap","atd":"snap","atjit":"snap","zoom":"ease","camrx":"snap","camry":"snap","camrz":"snap","palcycle":"ease","heatboost":"snap","rise":"snap","burn":"snap","fade":"snap","diffuse":"snap","diffkeep":"snap","echo":"snap","echoang":"snap","echokeep":"snap","zfb":"snap","zfbkeep":"snap","swirl":"snap","swirlkeep":"snap","twist":"snap","wedgeseg":"snap","wedgerot":"snap","glitch":"snap","glitchrows":"snap","pixel":"snap","soften":"snap","softrad":"snap","edge":"snap","poster":"snap","halfdot":"snap","halfamt":"snap","threshlvl":"snap","threshamt":"snap","chroma":"snap","mirror":"snap","bloom":"snap","barrel":"snap","scan":"snap","scancount":"snap","vignette":"snap","grain":"snap","band":"snap","bandsize":"snap","banddim":"snap"},"plen":{"boxsize":0.2,"points":0.2,"speed":0.2,"size":0.2,"rot":0.2,"nod":0.2,"nodspd":0.2,"sway":0.2,"rpm":0.2,"ratio":0.2,"inrad":0.2,"outrad":0.2,"phase":0.2,"cardx":0.2,"pspeed":0.2,"pscale":0.2,"pwarp":0.2,"tunspeed":0.2,"tuntwist":0.2,"tunrings":0.2,"mbcount":0.2,"mbradius":0.2,"mbspeed":0.2,"mbgain":0.2,"ksegments":0.2,"krotspeed":0.2,"knoisespeed":0.2,"rzrot":0.2,"rzzoom":0.2,"rztile":0.2,"xorspeed":0.2,"xorscale":0.2,"xormask":0.2,"mofreq":0.2,"modrift":0.2,"momix":0.2,"nwspin":0.2,"nwrelax":0.2,"mbexp":0.2,"cbcount":0.2,"cbspeed":0.2,"cbwidth":0.2,"pgsides":0.2,"pgrad":0.2,"pgthick":0.2,"pgspin":0.2,"sgcells":0.2,"sgdot":0.2,"sgsquare":0.2,"sgpulse":0.2,"sgspeed":0.2,"cosides":0.2,"cocount":0.2,"cothick":0.2,"cospeed":0.2,"cospin":0.2,"bncount":0.2,"bnrad":0.2,"bnsquare":0.2,"bnspeed":0.2,"sdcount":0.2,"sdsize":0.2,"sdmix":0.2,"sdspeed":0.2,"sdspin":0.2,"sdrim":0.2,"ata":0.2,"atb":0.2,"atc":0.2,"atd":0.2,"atjit":0.2,"zoom":1,"camrx":0.2,"camry":0.2,"camrz":0.2,"palcycle":0.2,"heatboost":0.2,"rise":0.2,"burn":0.2,"fade":0.2,"diffuse":0.2,"diffkeep":0.2,"echo":0.2,"echoang":0.2,"echokeep":0.2,"zfb":0.2,"zfbkeep":0.2,"swirl":0.2,"swirlkeep":0.2,"twist":0.2,"wedgeseg":0.2,"wedgerot":0.2,"glitch":0.2,"glitchrows":0.2,"pixel":0.2,"soften":0.2,"softrad":0.2,"edge":0.2,"poster":0.2,"halfdot":0.2,"halfamt":0.2,"threshlvl":0.2,"threshamt":0.2,"chroma":0.2,"mirror":0.2,"bloom":0.2,"barrel":0.2,"scan":0.2,"scancount":0.2,"vignette":0.2,"grain":0.2,"band":0.2,"bandsize":0.2,"banddim":0.2},"sceneFx":{"on":["bloom"],"vals":{"bloom":[1.09239130434783,1.09239130434783],"barrel":[0.15,0.15],"scan":[0.35,0.35],"scancount":[240,240],"vignette":[0.4,0.4],"grain":[0.08,0.08]}},"beatTune":{"fluxK":[4.5,4.6,4.7],"floor":0.1,"refract":[110,100,70],"bands":[[30,150],[150,2500],[2500,12000]]},"ranges":{},"ttl":[30,90],"tdur":[0.45,0.9],"extra":{"palette":"0","paletteRev":false,"paletteBg":"black","morph":true,"showBox":true,"randSeed":true,"filters":["fade","swirl","wedge"],"seedPath":"cardioid","seedRide":true,"seedPts":[]},"layers":null},{"name":"Round and round","effect":"moire","state":{"rise":[130,130],"burn":[120,120],"fade":[0.94,0.94],"diffuse":[1,1],"diffkeep":[0.97,0.97],"echo":[2,2],"echoang":[90,90],"echokeep":[0.94,0.94],"zfb":[1.02,1.02],"zfbkeep":[0.5,0.995],"swirl":[-15,15],"swirlkeep":[0.94,0.94],"twist":[1.2,1.2],"wedgeseg":[6,6],"wedgerot":[0,0],"glitch":[0.05,0.05],"glitchrows":[8,8],"pixel":[6,6],"soften":[-0.6,-0.6],"softrad":[1.5,1.5],"edge":[0.7,0.7],"poster":[5,5],"halfdot":[4,4],"halfamt":[0.8,0.8],"threshlvl":[0.5,0.5],"threshamt":[0.8,0.8],"chroma":[1,1],"mirror":[1,1],"bloom":[0.326086956521739,0.326086956521739],"barrel":[0.6,0.6],"scan":[0.35,0.35],"scancount":[240,240],"vignette":[0.4,0.4],"grain":[0.08,0.08],"camrx":[0,0],"camry":[0,0],"camrz":[0,0],"heatboost":[0,0],"palcycle":[8,8],"palhold":[0,0],"mofreq":[16.6630434782609,17.4891304347826],"modrift":[0.326086956521739,0.766304347826087],"momix":[0,0.228260869565217],"zoom":[0.897072323515812,1.39402173913043],"band":[0,0],"bandsize":[1,1],"banddim":[0,0]},"beat":{"boxsize":{"low":false,"mid":false,"high":false},"points":{"low":false,"mid":false,"high":false},"speed":{"low":false,"mid":false,"high":false},"size":{"low":false,"mid":false,"high":false},"rot":{"low":false,"mid":false,"high":false},"nod":{"low":false,"mid":false,"high":false},"nodspd":{"low":false,"mid":false,"high":false},"sway":{"low":false,"mid":false,"high":false},"rpm":{"low":false,"mid":false,"high":false},"ratio":{"low":false,"mid":false,"high":false},"inrad":{"low":false,"mid":false,"high":false},"outrad":{"low":false,"mid":false,"high":false},"phase":{"low":false,"mid":false,"high":false},"cardx":{"low":false,"mid":false,"high":false},"pspeed":{"low":false,"mid":false,"high":false},"pscale":{"low":false,"mid":false,"high":false},"pwarp":{"low":false,"mid":false,"high":false},"tunspeed":{"low":false,"mid":false,"high":false},"tuntwist":{"low":false,"mid":false,"high":false},"tunrings":{"low":false,"mid":false,"high":false},"mbcount":{"low":false,"mid":false,"high":false},"mbradius":{"low":false,"mid":false,"high":false},"mbspeed":{"low":false,"mid":false,"high":false},"mbgain":{"low":false,"mid":false,"high":false},"ksegments":{"low":false,"mid":false,"high":false},"krotspeed":{"low":false,"mid":false,"high":false},"knoisespeed":{"low":false,"mid":false,"high":false},"rzrot":{"low":false,"mid":false,"high":false},"rzzoom":{"low":false,"mid":false,"high":false},"rztile":{"low":false,"mid":false,"high":false},"xorspeed":{"low":false,"mid":false,"high":false},"xorscale":{"low":false,"mid":false,"high":false},"xormask":{"low":false,"mid":false,"high":false},"mofreq":{"low":false,"mid":false,"high":false},"modrift":{"low":false,"mid":false,"high":false},"momix":{"low":false,"mid":false,"high":false},"nwspin":{"low":false,"mid":false,"high":false},"nwrelax":{"low":false,"mid":false,"high":false},"mbexp":{"low":false,"mid":false,"high":false},"cbcount":{"low":false,"mid":false,"high":false},"cbspeed":{"low":false,"mid":false,"high":false},"cbwidth":{"low":false,"mid":false,"high":false},"pgsides":{"low":false,"mid":false,"high":false},"pgrad":{"low":false,"mid":false,"high":false},"pgthick":{"low":false,"mid":false,"high":false},"pgspin":{"low":false,"mid":false,"high":false},"sgcells":{"low":false,"mid":false,"high":false},"sgdot":{"low":false,"mid":false,"high":false},"sgsquare":{"low":false,"mid":false,"high":false},"sgpulse":{"low":false,"mid":false,"high":false},"sgspeed":{"low":false,"mid":false,"high":false},"cosides":{"low":false,"mid":false,"high":false},"cocount":{"low":false,"mid":false,"high":false},"cothick":{"low":false,"mid":false,"high":false},"cospeed":{"low":false,"mid":false,"high":false},"cospin":{"low":false,"mid":false,"high":false},"bncount":{"low":false,"mid":false,"high":false},"bnrad":{"low":false,"mid":false,"high":false},"bnsquare":{"low":false,"mid":false,"high":false},"bnspeed":{"low":false,"mid":false,"high":false},"sdcount":{"low":false,"mid":false,"high":false},"sdsize":{"low":false,"mid":false,"high":false},"sdmix":{"low":false,"mid":false,"high":false},"sdspeed":{"low":false,"mid":false,"high":false},"sdspin":{"low":false,"mid":false,"high":false},"sdrim":{"low":false,"mid":false,"high":false},"ata":{"low":false,"mid":false,"high":false},"atb":{"low":false,"mid":false,"high":false},"atc":{"low":false,"mid":false,"high":false},"atd":{"low":false,"mid":false,"high":false},"atjit":{"low":false,"mid":false,"high":false},"zoom":{"low":false,"mid":false,"high":false},"camrx":{"low":false,"mid":false,"high":false},"camry":{"low":false,"mid":false,"high":false},"camrz":{"low":false,"mid":false,"high":false},"palcycle":{"low":false,"mid":false,"high":false},"heatboost":{"low":false,"mid":false,"high":false},"rise":{"low":false,"mid":false,"high":false},"burn":{"low":false,"mid":false,"high":false},"fade":{"low":false,"mid":false,"high":false},"diffuse":{"low":false,"mid":false,"high":false},"diffkeep":{"low":false,"mid":false,"high":false},"echo":{"low":false,"mid":false,"high":false},"echoang":{"low":false,"mid":false,"high":false},"echokeep":{"low":false,"mid":false,"high":false},"zfb":{"low":false,"mid":false,"high":false},"zfbkeep":{"low":false,"mid":true,"high":false},"swirl":{"low":false,"mid":false,"high":false},"swirlkeep":{"low":false,"mid":false,"high":false},"twist":{"low":false,"mid":false,"high":false},"wedgeseg":{"low":false,"mid":false,"high":false},"wedgerot":{"low":false,"mid":false,"high":false},"glitch":{"low":false,"mid":false,"high":false},"glitchrows":{"low":false,"mid":false,"high":false},"pixel":{"low":false,"mid":false,"high":false},"soften":{"low":false,"mid":false,"high":false},"softrad":{"low":false,"mid":false,"high":false},"edge":{"low":false,"mid":false,"high":false},"poster":{"low":false,"mid":false,"high":false},"halfdot":{"low":false,"mid":false,"high":false},"halfamt":{"low":false,"mid":false,"high":false},"threshlvl":{"low":false,"mid":false,"high":false},"threshamt":{"low":false,"mid":false,"high":false},"chroma":{"low":false,"mid":false,"high":false},"mirror":{"low":false,"mid":false,"high":false},"bloom":{"low":false,"mid":false,"high":false},"barrel":{"low":false,"mid":false,"high":false},"scan":{"low":false,"mid":false,"high":false},"scancount":{"low":false,"mid":false,"high":false},"vignette":{"low":false,"mid":false,"high":false},"grain":{"low":false,"mid":false,"high":false},"band":{"low":false,"mid":false,"high":false},"bandsize":{"low":false,"mid":false,"high":false},"banddim":{"low":false,"mid":false,"high":false}},"pulse":{"boxsize":"snap","points":"snap","speed":"snap","size":"snap","rot":"snap","nod":"snap","nodspd":"snap","sway":"snap","rpm":"snap","ratio":"snap","inrad":"snap","outrad":"snap","phase":"snap","cardx":"snap","pspeed":"snap","pscale":"snap","pwarp":"snap","tunspeed":"snap","tuntwist":"snap","tunrings":"snap","mbcount":"snap","mbradius":"snap","mbspeed":"snap","mbgain":"snap","ksegments":"snap","krotspeed":"snap","knoisespeed":"snap","rzrot":"snap","rzzoom":"snap","rztile":"snap","xorspeed":"snap","xorscale":"snap","xormask":"snap","mofreq":"snap","modrift":"ease","momix":"ease","nwspin":"snap","nwrelax":"snap","mbexp":"snap","cbcount":"snap","cbspeed":"snap","cbwidth":"snap","pgsides":"snap","pgrad":"snap","pgthick":"snap","pgspin":"snap","sgcells":"snap","sgdot":"snap","sgsquare":"snap","sgpulse":"snap","sgspeed":"snap","cosides":"snap","cocount":"snap","cothick":"snap","cospeed":"snap","cospin":"snap","bncount":"snap","bnrad":"snap","bnsquare":"snap","bnspeed":"snap","sdcount":"snap","sdsize":"snap","sdmix":"snap","sdspeed":"snap","sdspin":"snap","sdrim":"snap","ata":"snap","atb":"snap","atc":"snap","atd":"snap","atjit":"snap","zoom":"snap","camrx":"snap","camry":"snap","camrz":"snap","palcycle":"snap","heatboost":"snap","rise":"snap","burn":"snap","fade":"snap","diffuse":"snap","diffkeep":"snap","echo":"snap","echoang":"snap","echokeep":"snap","zfb":"snap","zfbkeep":"snap","swirl":"snap","swirlkeep":"snap","twist":"snap","wedgeseg":"snap","wedgerot":"snap","glitch":"snap","glitchrows":"snap","pixel":"snap","soften":"snap","softrad":"snap","edge":"snap","poster":"snap","halfdot":"snap","halfamt":"snap","threshlvl":"snap","threshamt":"snap","chroma":"snap","mirror":"snap","bloom":"snap","barrel":"snap","scan":"snap","scancount":"snap","vignette":"snap","grain":"snap","band":"snap","bandsize":"snap","banddim":"snap"},"plen":{"boxsize":0.2,"points":0.2,"speed":0.2,"size":0.2,"rot":0.2,"nod":0.2,"nodspd":0.2,"sway":0.2,"rpm":0.2,"ratio":0.2,"inrad":0.2,"outrad":0.2,"phase":0.2,"cardx":0.2,"pspeed":0.2,"pscale":0.2,"pwarp":0.2,"tunspeed":0.2,"tuntwist":0.2,"tunrings":0.2,"mbcount":0.2,"mbradius":0.2,"mbspeed":0.2,"mbgain":0.2,"ksegments":0.2,"krotspeed":0.2,"knoisespeed":0.2,"rzrot":0.2,"rzzoom":0.2,"rztile":0.2,"xorspeed":0.2,"xorscale":0.2,"xormask":0.2,"mofreq":0.32,"modrift":0.28,"momix":0.17,"nwspin":0.2,"nwrelax":0.2,"mbexp":0.2,"cbcount":0.2,"cbspeed":0.2,"cbwidth":0.2,"pgsides":0.2,"pgrad":0.2,"pgthick":0.2,"pgspin":0.2,"sgcells":0.2,"sgdot":0.2,"sgsquare":0.2,"sgpulse":0.2,"sgspeed":0.2,"cosides":0.2,"cocount":0.2,"cothick":0.2,"cospeed":0.2,"cospin":0.2,"bncount":0.2,"bnrad":0.2,"bnsquare":0.2,"bnspeed":0.2,"sdcount":0.2,"sdsize":0.2,"sdmix":0.2,"sdspeed":0.2,"sdspin":0.2,"sdrim":0.2,"ata":0.2,"atb":0.2,"atc":0.2,"atd":0.2,"atjit":0.2,"zoom":0.2,"camrx":0.2,"camry":0.2,"camrz":0.2,"palcycle":0.2,"heatboost":0.2,"rise":0.2,"burn":0.2,"fade":0.2,"diffuse":0.2,"diffkeep":0.2,"echo":0.2,"echoang":0.2,"echokeep":0.2,"zfb":0.2,"zfbkeep":0.39,"swirl":0.2,"swirlkeep":0.2,"twist":0.2,"wedgeseg":0.2,"wedgerot":0.2,"glitch":0.2,"glitchrows":0.2,"pixel":0.2,"soften":0.2,"softrad":0.2,"edge":0.2,"poster":0.2,"halfdot":0.2,"halfamt":0.2,"threshlvl":0.2,"threshamt":0.2,"chroma":0.2,"mirror":0.2,"bloom":0.2,"barrel":0.2,"scan":0.2,"scancount":0.2,"vignette":0.2,"grain":0.2,"band":0.2,"bandsize":0.2,"banddim":0.2},"sceneFx":{"on":[],"vals":{}},"beatTune":{"fluxK":[4.8,4.6,4.2],"floor":0.12,"refract":[245,225,235],"bands":[[30,250],[250,2500],[2500,12000]]},"ranges":{},"extra":{"palette":"10","paletteRev":false,"paletteBg":"palette","morph":true,"showBox":true,"randSeed":true,"filters":["zoomfb","swirl"],"seedPath":"freehand","seedRide":true,"seedPts":[[-0.8924,-0.29],[-0.7941,-0.2987],[-0.7013,-0.3337],[-0.6079,-0.3662],[-0.5432,-0.4399],[-0.4731,-0.4956],[-0.3735,-0.4956],[-0.2985,-0.5496],[-0.2455,-0.6325],[-0.1823,-0.7087],[-0.1151,-0.7819],[-0.0394,-0.84],[0.0589,-0.8388],[0.1535,-0.8119],[0.2246,-0.8589],[0.2705,-0.9457],[0.3503,-1.0011],[0.4375,-1.045],[0.5366,-1.0492],[0.6116,-0.9964],[0.6472,-0.9041],[0.7083,-0.8365],[0.7098,-0.9167],[0.651,-0.9913],[0.5576,-1.0228],[0.4589,-1.0163],[0.3647,-0.9892],[0.2727,-0.9532],[0.2191,-0.8714],[0.1382,-0.8225],[0.0418,-0.8278],[-0.0545,-0.8267],[-0.1123,-0.7468],[-0.1741,-0.6702],[-0.2616,-0.6302],[-0.3255,-0.5558],[-0.4184,-0.5272],[-0.518,-0.5272],[-0.5993,-0.4958],[-0.6746,-0.4486],[-0.7712,-0.464],[-0.8504,-0.4179],[-0.8554,-0.3213],[-0.915,-0.2546]]},"layers":[{"effect":"copperbars","state":{"rise":[130,130],"burn":[120,120],"fade":[0.94,0.94],"diffuse":[1,1],"diffkeep":[0.97,0.97],"echo":[2,2],"echoang":[90,90],"echokeep":[0.94,0.94],"zfb":[1.03695652173913,1.1],"zfbkeep":[0.94,0.94],"swirl":[2,2],"swirlkeep":[0.94,0.94],"twist":[-1.1304347826087,4],"wedgeseg":[10.0652173913043,10.0652173913043],"wedgerot":[0,0],"glitch":[0.05,0.05],"glitchrows":[8,8],"pixel":[6,6],"soften":[-0.6,-0.6],"softrad":[1.5,1.5],"edge":[0.7,0.7],"poster":[5,5],"halfdot":[4,4],"halfamt":[0.8,0.8],"threshlvl":[0.5,0.5],"threshamt":[0.8,0.8],"chroma":[1,1],"mirror":[1,1],"bloom":[0.326086956521739,0.326086956521739],"barrel":[0.6,0.6],"scan":[0.35,0.35],"scancount":[240,240],"vignette":[0.4,0.4],"grain":[0.08,0.08],"heatboost":[0,0],"palcycle":[0,0],"palhold":[0,0],"cbcount":[7,7],"cbspeed":[0.146739130434783,0.945652173913044],"cbwidth":[0.0352173913043478,0.155434782608696],"band":[0,0],"bandsize":[4,4],"banddim":[0,0]},"cam":{"camrx":[0,0],"camry":[0,0],"camrz":[0,0],"zoom":[0.9375,1.45108695652174]},"beat":{"boxsize":{"low":false,"mid":false,"high":false},"points":{"low":false,"mid":false,"high":false},"speed":{"low":false,"mid":false,"high":false},"size":{"low":false,"mid":false,"high":false},"rot":{"low":false,"mid":false,"high":false},"nod":{"low":false,"mid":false,"high":false},"nodspd":{"low":false,"mid":false,"high":false},"sway":{"low":false,"mid":false,"high":false},"rpm":{"low":false,"mid":false,"high":false},"ratio":{"low":false,"mid":false,"high":false},"inrad":{"low":false,"mid":false,"high":false},"outrad":{"low":false,"mid":false,"high":false},"phase":{"low":false,"mid":false,"high":false},"cardx":{"low":false,"mid":false,"high":false},"pspeed":{"low":false,"mid":false,"high":false},"pscale":{"low":false,"mid":false,"high":false},"pwarp":{"low":false,"mid":false,"high":false},"tunspeed":{"low":false,"mid":false,"high":false},"tuntwist":{"low":false,"mid":false,"high":false},"tunrings":{"low":false,"mid":false,"high":false},"mbcount":{"low":false,"mid":false,"high":false},"mbradius":{"low":false,"mid":false,"high":false},"mbspeed":{"low":false,"mid":false,"high":false},"mbgain":{"low":false,"mid":false,"high":false},"ksegments":{"low":false,"mid":false,"high":false},"krotspeed":{"low":false,"mid":false,"high":false},"knoisespeed":{"low":false,"mid":false,"high":false},"rzrot":{"low":false,"mid":false,"high":false},"rzzoom":{"low":false,"mid":false,"high":false},"rztile":{"low":false,"mid":false,"high":false},"xorspeed":{"low":false,"mid":false,"high":false},"xorscale":{"low":false,"mid":false,"high":false},"xormask":{"low":false,"mid":false,"high":false},"mofreq":{"low":false,"mid":false,"high":false},"modrift":{"low":false,"mid":false,"high":false},"momix":{"low":false,"mid":false,"high":false},"nwspin":{"low":false,"mid":false,"high":false},"nwrelax":{"low":false,"mid":false,"high":false},"mbexp":{"low":false,"mid":false,"high":false},"cbcount":{"low":false,"mid":false,"high":false},"cbspeed":{"low":true,"mid":false,"high":false},"cbwidth":{"low":false,"mid":false,"high":false},"pgsides":{"low":false,"mid":false,"high":false},"pgrad":{"low":false,"mid":false,"high":false},"pgthick":{"low":false,"mid":false,"high":false},"pgspin":{"low":false,"mid":false,"high":false},"sgcells":{"low":false,"mid":false,"high":false},"sgdot":{"low":false,"mid":false,"high":false},"sgsquare":{"low":false,"mid":false,"high":false},"sgpulse":{"low":false,"mid":false,"high":false},"sgspeed":{"low":false,"mid":false,"high":false},"cosides":{"low":false,"mid":false,"high":false},"cocount":{"low":false,"mid":false,"high":false},"cothick":{"low":false,"mid":false,"high":false},"cospeed":{"low":false,"mid":false,"high":false},"cospin":{"low":false,"mid":false,"high":false},"bncount":{"low":false,"mid":false,"high":false},"bnrad":{"low":false,"mid":false,"high":false},"bnsquare":{"low":false,"mid":false,"high":false},"bnspeed":{"low":false,"mid":false,"high":false},"sdcount":{"low":false,"mid":false,"high":false},"sdsize":{"low":false,"mid":false,"high":false},"sdmix":{"low":false,"mid":false,"high":false},"sdspeed":{"low":false,"mid":false,"high":false},"sdspin":{"low":false,"mid":false,"high":false},"sdrim":{"low":false,"mid":false,"high":false},"ata":{"low":false,"mid":false,"high":false},"atb":{"low":false,"mid":false,"high":false},"atc":{"low":false,"mid":false,"high":false},"atd":{"low":false,"mid":false,"high":false},"atjit":{"low":false,"mid":false,"high":false},"zoom":{"low":false,"mid":false,"high":false},"camrx":{"low":false,"mid":false,"high":false},"camry":{"low":false,"mid":false,"high":false},"camrz":{"low":false,"mid":false,"high":false},"palcycle":{"low":false,"mid":false,"high":false},"heatboost":{"low":false,"mid":false,"high":false},"rise":{"low":false,"mid":false,"high":false},"burn":{"low":false,"mid":false,"high":false},"fade":{"low":false,"mid":false,"high":false},"diffuse":{"low":false,"mid":false,"high":false},"diffkeep":{"low":false,"mid":false,"high":false},"echo":{"low":false,"mid":false,"high":false},"echoang":{"low":false,"mid":false,"high":false},"echokeep":{"low":false,"mid":false,"high":false},"zfb":{"low":false,"mid":false,"high":false},"zfbkeep":{"low":false,"mid":false,"high":false},"swirl":{"low":false,"mid":false,"high":false},"swirlkeep":{"low":false,"mid":false,"high":false},"twist":{"low":false,"mid":false,"high":false},"wedgeseg":{"low":false,"mid":false,"high":false},"wedgerot":{"low":false,"mid":false,"high":false},"glitch":{"low":false,"mid":false,"high":false},"glitchrows":{"low":false,"mid":false,"high":false},"pixel":{"low":false,"mid":false,"high":false},"soften":{"low":false,"mid":false,"high":false},"softrad":{"low":false,"mid":false,"high":false},"edge":{"low":false,"mid":false,"high":false},"poster":{"low":false,"mid":false,"high":false},"halfdot":{"low":false,"mid":false,"high":false},"halfamt":{"low":false,"mid":false,"high":false},"threshlvl":{"low":false,"mid":false,"high":false},"threshamt":{"low":false,"mid":false,"high":false},"chroma":{"low":false,"mid":false,"high":false},"mirror":{"low":false,"mid":false,"high":false},"bloom":{"low":false,"mid":false,"high":false},"barrel":{"low":false,"mid":false,"high":false},"scan":{"low":false,"mid":false,"high":false},"scancount":{"low":false,"mid":false,"high":false},"vignette":{"low":false,"mid":false,"high":false},"grain":{"low":false,"mid":false,"high":false},"band":{"low":false,"mid":false,"high":false},"bandsize":{"low":false,"mid":false,"high":false},"banddim":{"low":false,"mid":false,"high":false}},"pulse":{"boxsize":"snap","points":"snap","speed":"snap","size":"snap","rot":"snap","nod":"snap","nodspd":"snap","sway":"snap","rpm":"snap","ratio":"snap","inrad":"snap","outrad":"snap","phase":"snap","cardx":"snap","pspeed":"snap","pscale":"snap","pwarp":"snap","tunspeed":"snap","tuntwist":"snap","tunrings":"snap","mbcount":"snap","mbradius":"snap","mbspeed":"snap","mbgain":"snap","ksegments":"snap","krotspeed":"snap","knoisespeed":"snap","rzrot":"snap","rzzoom":"snap","rztile":"snap","xorspeed":"snap","xorscale":"snap","xormask":"snap","mofreq":"snap","modrift":"snap","momix":"snap","nwspin":"snap","nwrelax":"snap","mbexp":"snap","cbcount":"snap","cbspeed":"ease","cbwidth":"bounce","pgsides":"snap","pgrad":"snap","pgthick":"snap","pgspin":"snap","sgcells":"snap","sgdot":"snap","sgsquare":"snap","sgpulse":"snap","sgspeed":"snap","cosides":"snap","cocount":"snap","cothick":"snap","cospeed":"snap","cospin":"snap","bncount":"snap","bnrad":"snap","bnsquare":"snap","bnspeed":"snap","sdcount":"snap","sdsize":"snap","sdmix":"snap","sdspeed":"snap","sdspin":"snap","sdrim":"snap","ata":"snap","atb":"snap","atc":"snap","atd":"snap","atjit":"snap","zoom":"snap","camrx":"snap","camry":"snap","camrz":"snap","palcycle":"snap","heatboost":"snap","rise":"snap","burn":"snap","fade":"snap","diffuse":"snap","diffkeep":"snap","echo":"snap","echoang":"snap","echokeep":"snap","zfb":"snap","zfbkeep":"snap","swirl":"snap","swirlkeep":"snap","twist":"snap","wedgeseg":"snap","wedgerot":"snap","glitch":"snap","glitchrows":"snap","pixel":"snap","soften":"snap","softrad":"snap","edge":"snap","poster":"snap","halfdot":"snap","halfamt":"snap","threshlvl":"snap","threshamt":"snap","chroma":"snap","mirror":"snap","bloom":"snap","barrel":"snap","scan":"snap","scancount":"snap","vignette":"snap","grain":"snap","band":"snap","bandsize":"snap","banddim":"snap"},"plen":{"boxsize":0.2,"points":0.2,"speed":0.2,"size":0.2,"rot":0.2,"nod":0.2,"nodspd":0.2,"sway":0.2,"rpm":0.2,"ratio":0.2,"inrad":0.2,"outrad":0.2,"phase":0.2,"cardx":0.2,"pspeed":0.2,"pscale":0.2,"pwarp":0.2,"tunspeed":0.2,"tuntwist":0.2,"tunrings":0.2,"mbcount":0.2,"mbradius":0.2,"mbspeed":0.2,"mbgain":0.2,"ksegments":0.2,"krotspeed":0.2,"knoisespeed":0.2,"rzrot":0.2,"rzzoom":0.2,"rztile":0.2,"xorspeed":0.2,"xorscale":0.2,"xormask":0.2,"mofreq":0.2,"modrift":0.2,"momix":0.2,"nwspin":0.2,"nwrelax":0.2,"mbexp":0.2,"cbcount":0.2,"cbspeed":0.19,"cbwidth":0.55,"pgsides":0.2,"pgrad":0.2,"pgthick":0.2,"pgspin":0.2,"sgcells":0.2,"sgdot":0.2,"sgsquare":0.2,"sgpulse":0.2,"sgspeed":0.2,"cosides":0.2,"cocount":0.2,"cothick":0.2,"cospeed":0.2,"cospin":0.2,"bncount":0.2,"bnrad":0.2,"bnsquare":0.2,"bnspeed":0.2,"sdcount":0.2,"sdsize":0.2,"sdmix":0.2,"sdspeed":0.2,"sdspin":0.2,"sdrim":0.2,"ata":0.2,"atb":0.2,"atc":0.2,"atd":0.2,"atjit":0.2,"zoom":0.2,"camrx":0.2,"camry":0.2,"camrz":0.2,"palcycle":0.2,"heatboost":0.2,"rise":0.2,"burn":0.2,"fade":0.2,"diffuse":0.2,"diffkeep":0.2,"echo":0.2,"echoang":0.2,"echokeep":0.2,"zfb":0.2,"zfbkeep":0.2,"swirl":0.2,"swirlkeep":0.2,"twist":0.2,"wedgeseg":0.2,"wedgerot":0.2,"glitch":0.2,"glitchrows":0.2,"pixel":0.2,"soften":0.2,"softrad":0.2,"edge":0.2,"poster":0.2,"halfdot":0.2,"halfamt":0.2,"threshlvl":0.2,"threshamt":0.2,"chroma":0.2,"mirror":0.2,"bloom":0.2,"barrel":0.2,"scan":0.2,"scancount":0.2,"vignette":0.2,"grain":0.2,"band":0.2,"bandsize":0.2,"banddim":0.2},"palette":"11","paletteRev":false,"paletteBg":"palette","seedPath":"freehand","seedRide":true,"seedPts":[[-0.892381329113924,-0.2899791606783557],[-0.7941499523679943,-0.2986582081711814],[-0.7013478771559472,-0.33374207954914686],[-0.6078646240429741,-0.36621048675289186],[-0.5432022001510142,-0.4398624980418754],[-0.4730761229030561,-0.49560074734119],[-0.3735406884333029,-0.49560074734119],[-0.2984851647248552,-0.5496110316261392],[-0.24549346134103356,-0.6325321416919859],[-0.1822821503628587,-0.7087267875208212],[-0.11510038682565749,-0.7818830282822691],[-0.0393679865440834,-0.8400437987222055],[0.05889597432602796,-0.8387841440922937],[0.15353997943314623,-0.8119416498993963],[0.22463022939574456,-0.8588975480998787],[0.27049895491851533,-0.9457112294615578],[0.3503308719273792,-1.0010877846234238],[0.4375079638250053,-1.045001591391533],[0.5366282899231452,-1.049197326818051],[0.6115614157478545,-0.9964206777007518],[0.647201669618304,-0.9041122428322939],[0.7082640084165724,-0.836549425606783],[0.709827013868173,-0.9166797927482468],[0.6509856958229971,-0.9912517931956608],[0.5576200858356444,-1.0228355849382005],[0.45888365079664833,-1.0163397937747303],[0.3647077143830966,-0.9891583810284049],[0.2726760809982209,-0.9531588265449312],[0.2191265625892692,-0.8713776553954012],[0.13819888034940875,-0.8224863466513365],[0.04179930368681406,-0.8277586950273066],[-0.054451372375616515,-0.826662698942902],[-0.11231541977220771,-0.7468448409725819],[-0.1740660270468904,-0.6702447513610257],[-0.26162976815668326,-0.6302076533162888],[-0.3255383816256707,-0.5558094525637159],[-0.4184446341147301,-0.5272348375970106],[-0.5179800685844833,-0.5272348375970106],[-0.5993354522020162,-0.49583787224136866],[-0.6746369350879835,-0.448647943244131],[-0.771224617022741,-0.46396665708536944],[-0.8504497816113686,-0.41789510745190445],[-0.8554430379746832,-0.3213255603231302],[-0.9150001882594561,-0.254576425469272]],"ranges":{"cbcount-lo":{"min":"1","max":"12","step":"1"},"cbcount-hi":{"min":"1","max":"12","step":"1"},"palcycle-lo":{"min":"0","max":"12","step":"any"},"palcycle-hi":{"min":"0","max":"12","step":"any"},"bandsize-lo":{"min":"1","max":"9","step":"1"},"bandsize-hi":{"min":"1","max":"9","step":"1"}},"showBox":true,"filters":["fade","zoomfb","twist","wedge","bloom"],"blend":"max","gain":1,"mute":false},{"effect":"moire","state":{"rise":[130,130],"burn":[120,120],"fade":[0.94,0.94],"diffuse":[1,1],"diffkeep":[0.97,0.97],"echo":[2,2],"echoang":[90,90],"echokeep":[0.94,0.94],"zfb":[1.02,1.02],"zfbkeep":[0.5,0.995],"swirl":[-15,15],"swirlkeep":[0.94,0.94],"twist":[1.2,1.2],"wedgeseg":[6,6],"wedgerot":[0,0],"glitch":[0.05,0.05],"glitchrows":[8,8],"pixel":[6,6],"soften":[-0.6,-0.6],"softrad":[1.5,1.5],"edge":[0.7,0.7],"poster":[5,5],"halfdot":[4,4],"halfamt":[0.8,0.8],"threshlvl":[0.5,0.5],"threshamt":[0.8,0.8],"chroma":[1,1],"mirror":[1,1],"bloom":[0.326086956521739,0.326086956521739],"barrel":[0.6,0.6],"scan":[0.35,0.35],"scancount":[240,240],"vignette":[0.4,0.4],"grain":[0.08,0.08],"heatboost":[0,0],"palcycle":[8,8],"palhold":[0,0],"mofreq":[16.6630434782609,17.4891304347826],"modrift":[0.326086956521739,0.766304347826087],"momix":[0,0.228260869565217],"band":[0,0],"bandsize":[1,1],"banddim":[0,0]},"cam":{"camrx":[0,0],"camry":[0,0],"camrz":[0,0],"zoom":[0.897072323515812,1.39402173913043]},"beat":{"boxsize":{"low":false,"mid":false,"high":false},"points":{"low":false,"mid":false,"high":false},"speed":{"low":false,"mid":false,"high":false},"size":{"low":false,"mid":false,"high":false},"rot":{"low":false,"mid":false,"high":false},"nod":{"low":false,"mid":false,"high":false},"nodspd":{"low":false,"mid":false,"high":false},"sway":{"low":false,"mid":false,"high":false},"rpm":{"low":false,"mid":false,"high":false},"ratio":{"low":false,"mid":false,"high":false},"inrad":{"low":false,"mid":false,"high":false},"outrad":{"low":false,"mid":false,"high":false},"phase":{"low":false,"mid":false,"high":false},"cardx":{"low":false,"mid":false,"high":false},"pspeed":{"low":false,"mid":false,"high":false},"pscale":{"low":false,"mid":false,"high":false},"pwarp":{"low":false,"mid":false,"high":false},"tunspeed":{"low":false,"mid":false,"high":false},"tuntwist":{"low":false,"mid":false,"high":false},"tunrings":{"low":false,"mid":false,"high":false},"mbcount":{"low":false,"mid":false,"high":false},"mbradius":{"low":false,"mid":false,"high":false},"mbspeed":{"low":false,"mid":false,"high":false},"mbgain":{"low":false,"mid":false,"high":false},"ksegments":{"low":false,"mid":false,"high":false},"krotspeed":{"low":false,"mid":false,"high":false},"knoisespeed":{"low":false,"mid":false,"high":false},"rzrot":{"low":false,"mid":false,"high":false},"rzzoom":{"low":false,"mid":false,"high":false},"rztile":{"low":false,"mid":false,"high":false},"xorspeed":{"low":false,"mid":false,"high":false},"xorscale":{"low":false,"mid":false,"high":false},"xormask":{"low":false,"mid":false,"high":false},"mofreq":{"low":false,"mid":false,"high":false},"modrift":{"low":false,"mid":false,"high":false},"momix":{"low":false,"mid":false,"high":false},"nwspin":{"low":false,"mid":false,"high":false},"nwrelax":{"low":false,"mid":false,"high":false},"mbexp":{"low":false,"mid":false,"high":false},"cbcount":{"low":false,"mid":false,"high":false},"cbspeed":{"low":false,"mid":false,"high":false},"cbwidth":{"low":false,"mid":false,"high":false},"pgsides":{"low":false,"mid":false,"high":false},"pgrad":{"low":false,"mid":false,"high":false},"pgthick":{"low":false,"mid":false,"high":false},"pgspin":{"low":false,"mid":false,"high":false},"sgcells":{"low":false,"mid":false,"high":false},"sgdot":{"low":false,"mid":false,"high":false},"sgsquare":{"low":false,"mid":false,"high":false},"sgpulse":{"low":false,"mid":false,"high":false},"sgspeed":{"low":false,"mid":false,"high":false},"cosides":{"low":false,"mid":false,"high":false},"cocount":{"low":false,"mid":false,"high":false},"cothick":{"low":false,"mid":false,"high":false},"cospeed":{"low":false,"mid":false,"high":false},"cospin":{"low":false,"mid":false,"high":false},"bncount":{"low":false,"mid":false,"high":false},"bnrad":{"low":false,"mid":false,"high":false},"bnsquare":{"low":false,"mid":false,"high":false},"bnspeed":{"low":false,"mid":false,"high":false},"sdcount":{"low":false,"mid":false,"high":false},"sdsize":{"low":false,"mid":false,"high":false},"sdmix":{"low":false,"mid":false,"high":false},"sdspeed":{"low":false,"mid":false,"high":false},"sdspin":{"low":false,"mid":false,"high":false},"sdrim":{"low":false,"mid":false,"high":false},"ata":{"low":false,"mid":false,"high":false},"atb":{"low":false,"mid":false,"high":false},"atc":{"low":false,"mid":false,"high":false},"atd":{"low":false,"mid":false,"high":false},"atjit":{"low":false,"mid":false,"high":false},"zoom":{"low":false,"mid":false,"high":false},"camrx":{"low":false,"mid":false,"high":false},"camry":{"low":false,"mid":false,"high":false},"camrz":{"low":false,"mid":false,"high":false},"palcycle":{"low":false,"mid":false,"high":false},"heatboost":{"low":false,"mid":false,"high":false},"rise":{"low":false,"mid":false,"high":false},"burn":{"low":false,"mid":false,"high":false},"fade":{"low":false,"mid":false,"high":false},"diffuse":{"low":false,"mid":false,"high":false},"diffkeep":{"low":false,"mid":false,"high":false},"echo":{"low":false,"mid":false,"high":false},"echoang":{"low":false,"mid":false,"high":false},"echokeep":{"low":false,"mid":false,"high":false},"zfb":{"low":false,"mid":false,"high":false},"zfbkeep":{"low":false,"mid":true,"high":false},"swirl":{"low":false,"mid":false,"high":false},"swirlkeep":{"low":false,"mid":false,"high":false},"twist":{"low":false,"mid":false,"high":false},"wedgeseg":{"low":false,"mid":false,"high":false},"wedgerot":{"low":false,"mid":false,"high":false},"glitch":{"low":false,"mid":false,"high":false},"glitchrows":{"low":false,"mid":false,"high":false},"pixel":{"low":false,"mid":false,"high":false},"soften":{"low":false,"mid":false,"high":false},"softrad":{"low":false,"mid":false,"high":false},"edge":{"low":false,"mid":false,"high":false},"poster":{"low":false,"mid":false,"high":false},"halfdot":{"low":false,"mid":false,"high":false},"halfamt":{"low":false,"mid":false,"high":false},"threshlvl":{"low":false,"mid":false,"high":false},"threshamt":{"low":false,"mid":false,"high":false},"chroma":{"low":false,"mid":false,"high":false},"mirror":{"low":false,"mid":false,"high":false},"bloom":{"low":false,"mid":false,"high":false},"barrel":{"low":false,"mid":false,"high":false},"scan":{"low":false,"mid":false,"high":false},"scancount":{"low":false,"mid":false,"high":false},"vignette":{"low":false,"mid":false,"high":false},"grain":{"low":false,"mid":false,"high":false},"band":{"low":false,"mid":false,"high":false},"bandsize":{"low":false,"mid":false,"high":false},"banddim":{"low":false,"mid":false,"high":false}},"pulse":{"boxsize":"snap","points":"snap","speed":"snap","size":"snap","rot":"snap","nod":"snap","nodspd":"snap","sway":"snap","rpm":"snap","ratio":"snap","inrad":"snap","outrad":"snap","phase":"snap","cardx":"snap","pspeed":"snap","pscale":"snap","pwarp":"snap","tunspeed":"snap","tuntwist":"snap","tunrings":"snap","mbcount":"snap","mbradius":"snap","mbspeed":"snap","mbgain":"snap","ksegments":"snap","krotspeed":"snap","knoisespeed":"snap","rzrot":"snap","rzzoom":"snap","rztile":"snap","xorspeed":"snap","xorscale":"snap","xormask":"snap","mofreq":"snap","modrift":"ease","momix":"ease","nwspin":"snap","nwrelax":"snap","mbexp":"snap","cbcount":"snap","cbspeed":"snap","cbwidth":"snap","pgsides":"snap","pgrad":"snap","pgthick":"snap","pgspin":"snap","sgcells":"snap","sgdot":"snap","sgsquare":"snap","sgpulse":"snap","sgspeed":"snap","cosides":"snap","cocount":"snap","cothick":"snap","cospeed":"snap","cospin":"snap","bncount":"snap","bnrad":"snap","bnsquare":"snap","bnspeed":"snap","sdcount":"snap","sdsize":"snap","sdmix":"snap","sdspeed":"snap","sdspin":"snap","sdrim":"snap","ata":"snap","atb":"snap","atc":"snap","atd":"snap","atjit":"snap","zoom":"snap","camrx":"snap","camry":"snap","camrz":"snap","palcycle":"snap","heatboost":"snap","rise":"snap","burn":"snap","fade":"snap","diffuse":"snap","diffkeep":"snap","echo":"snap","echoang":"snap","echokeep":"snap","zfb":"snap","zfbkeep":"snap","swirl":"snap","swirlkeep":"snap","twist":"snap","wedgeseg":"snap","wedgerot":"snap","glitch":"snap","glitchrows":"snap","pixel":"snap","soften":"snap","softrad":"snap","edge":"snap","poster":"snap","halfdot":"snap","halfamt":"snap","threshlvl":"snap","threshamt":"snap","chroma":"snap","mirror":"snap","bloom":"snap","barrel":"snap","scan":"snap","scancount":"snap","vignette":"snap","grain":"snap","band":"snap","bandsize":"snap","banddim":"snap"},"plen":{"boxsize":0.2,"points":0.2,"speed":0.2,"size":0.2,"rot":0.2,"nod":0.2,"nodspd":0.2,"sway":0.2,"rpm":0.2,"ratio":0.2,"inrad":0.2,"outrad":0.2,"phase":0.2,"cardx":0.2,"pspeed":0.2,"pscale":0.2,"pwarp":0.2,"tunspeed":0.2,"tuntwist":0.2,"tunrings":0.2,"mbcount":0.2,"mbradius":0.2,"mbspeed":0.2,"mbgain":0.2,"ksegments":0.2,"krotspeed":0.2,"knoisespeed":0.2,"rzrot":0.2,"rzzoom":0.2,"rztile":0.2,"xorspeed":0.2,"xorscale":0.2,"xormask":0.2,"mofreq":0.32,"modrift":0.28,"momix":0.17,"nwspin":0.2,"nwrelax":0.2,"mbexp":0.2,"cbcount":0.2,"cbspeed":0.2,"cbwidth":0.2,"pgsides":0.2,"pgrad":0.2,"pgthick":0.2,"pgspin":0.2,"sgcells":0.2,"sgdot":0.2,"sgsquare":0.2,"sgpulse":0.2,"sgspeed":0.2,"cosides":0.2,"cocount":0.2,"cothick":0.2,"cospeed":0.2,"cospin":0.2,"bncount":0.2,"bnrad":0.2,"bnsquare":0.2,"bnspeed":0.2,"sdcount":0.2,"sdsize":0.2,"sdmix":0.2,"sdspeed":0.2,"sdspin":0.2,"sdrim":0.2,"ata":0.2,"atb":0.2,"atc":0.2,"atd":0.2,"atjit":0.2,"zoom":0.2,"camrx":0.2,"camry":0.2,"camrz":0.2,"palcycle":0.2,"heatboost":0.2,"rise":0.2,"burn":0.2,"fade":0.2,"diffuse":0.2,"diffkeep":0.2,"echo":0.2,"echoang":0.2,"echokeep":0.2,"zfb":0.2,"zfbkeep":0.39,"swirl":0.2,"swirlkeep":0.2,"twist":0.2,"wedgeseg":0.2,"wedgerot":0.2,"glitch":0.2,"glitchrows":0.2,"pixel":0.2,"soften":0.2,"softrad":0.2,"edge":0.2,"poster":0.2,"halfdot":0.2,"halfamt":0.2,"threshlvl":0.2,"threshamt":0.2,"chroma":0.2,"mirror":0.2,"bloom":0.2,"barrel":0.2,"scan":0.2,"scancount":0.2,"vignette":0.2,"grain":0.2,"band":0.2,"bandsize":0.2,"banddim":0.2},"palette":"10","paletteRev":false,"paletteBg":"palette","seedPath":"freehand","seedRide":true,"seedPts":[[-0.892381329113924,-0.2899791606783557],[-0.7941499523679943,-0.2986582081711814],[-0.7013478771559472,-0.33374207954914686],[-0.6078646240429741,-0.36621048675289186],[-0.5432022001510142,-0.4398624980418754],[-0.4730761229030561,-0.49560074734119],[-0.3735406884333029,-0.49560074734119],[-0.2984851647248552,-0.5496110316261392],[-0.24549346134103356,-0.6325321416919859],[-0.1822821503628587,-0.7087267875208212],[-0.11510038682565749,-0.7818830282822691],[-0.0393679865440834,-0.8400437987222055],[0.05889597432602796,-0.8387841440922937],[0.15353997943314623,-0.8119416498993963],[0.22463022939574456,-0.8588975480998787],[0.27049895491851533,-0.9457112294615578],[0.3503308719273792,-1.0010877846234238],[0.4375079638250053,-1.045001591391533],[0.5366282899231452,-1.049197326818051],[0.6115614157478545,-0.9964206777007518],[0.647201669618304,-0.9041122428322939],[0.7082640084165724,-0.836549425606783],[0.709827013868173,-0.9166797927482468],[0.6509856958229971,-0.9912517931956608],[0.5576200858356444,-1.0228355849382005],[0.45888365079664833,-1.0163397937747303],[0.3647077143830966,-0.9891583810284049],[0.2726760809982209,-0.9531588265449312],[0.2191265625892692,-0.8713776553954012],[0.13819888034940875,-0.8224863466513365],[0.04179930368681406,-0.8277586950273066],[-0.054451372375616515,-0.826662698942902],[-0.11231541977220771,-0.7468448409725819],[-0.1740660270468904,-0.6702447513610257],[-0.26162976815668326,-0.6302076533162888],[-0.3255383816256707,-0.5558094525637159],[-0.4184446341147301,-0.5272348375970106],[-0.5179800685844833,-0.5272348375970106],[-0.5993354522020162,-0.49583787224136866],[-0.6746369350879835,-0.448647943244131],[-0.771224617022741,-0.46396665708536944],[-0.8504497816113686,-0.41789510745190445],[-0.8554430379746832,-0.3213255603231302],[-0.9150001882594561,-0.254576425469272]],"ranges":{},"showBox":true,"filters":["zoomfb","swirl"],"blend":"diff","gain":0.74,"mute":false}]}];
  // One neutral scene per effect. No longer the shipped library — it is only the last-ditch
  // fallback above, kept so a DEFAULT_LIBRARY naming a retired effect cannot leave a visitor
  // with nothing at all.
  function perEffectPresets() {
    return EFFECTS.map((f, e) => ({ name: f.presetName || f.name, effect: e, state: presetState(e), beat: presetBeat(e), pulse: presetPulse(e), plen: presetPlen(e), extra: presetExtra(e), beatTune: mergeBeatTune(null), ranges: {} }));
  }
  function rebuildPresetOptions() {
    presetSel.innerHTML = "";
    presets.forEach((p, i) => presetSel.appendChild(new Option(p.name, String(i))));
    presetSel.value = String(curPreset);
    buildPresetList();
  }

  // ---- something is ALWAYS selected ---------------------------------------------------
  // THE one choke point for the invariant, rather than a clamp repeated at each of the eight
  // places that used to drop to "— unsaved scene —". Seeds the library if it is empty (the
  // same defaults the first visit uses) and pulls curPreset into range.
  //
  // An empty library has to be impossible, not merely unlikely: with no scratch mode,
  // autosavePreset() writes on every edit, and it needs somewhere to write.
  function ensureSelection() {
    if (!presets.length) presets = defaultPresets();
    if (!(curPreset >= 0 && curPreset < presets.length)) curPreset = 0;
  }

  // A shared link's scene, adopted into the library under its own collection.
  //
  // WHY THIS IS NOT DONE IN installShared. The legacy `?s=` path calls installShared
  // SYNCHRONOUSLY while audio-tuning-data.js is still loading — three slices before this one.
  // Two things are wrong at that moment: every `const` down here is in the temporal dead zone,
  // and, worse, restore() has not run, so `presets` is still empty and whatever we pushed would
  // be thrown away by the load that follows. So installShared only parks `pendingShared`, and
  // the write happens here, from callers that run after startup has settled.
  //
  // Idempotent — it clears the marker — because it is called from three places that cannot all
  // be ordered against each other: the startup epilogue (which covers the sync ?s= path) and
  // the ?z= / #c= promise handlers (which land after every slice has run).
  //
  // A collection, not a loose scene, so the same guarantees the gallery already provides apply:
  // it cannot collide with a scene of your own that shares its name, the group folds, and its
  // ✕ removes the whole set.
  const SHARED_COLLECTION = "Shared with you";
  function adoptSharedScene() {
    if (!pendingShared) return false;
    const want = pendingShared;
    pendingShared = null;
    // sceneBlob() carries no name — a shared scene has nothing to be called — so #c= links pass
    // the sender's own name through and everything else falls back to a default.
    // bumpName ONLY when the name is already taken: it always bumps, so calling it
    // unconditionally made the very first shared scene "Shared scene 2".
    const base = (want.name || "Shared scene").slice(0, 60);
    const name = presets.some(p => p.name === base) ? bumpName(base) : base;
    presets.push({ name, collection: SHARED_COLLECTION, ...snapshotScene() });
    curPreset = presets.length - 1;
    openCollections.add(SHARED_COLLECTION);   // opened, or the scene you just received is hidden
    stopCycling();                            // ...and stays on screen; auto-cycle is on by default
    rebuildPresetOptions();
    persist();
    return true;
  }

  // ---- Scene collections -------------------------------------------------------------
  // A preset carries an optional `collection`: the name of the published profile it came
  // from. Absent (or empty) means it is one of YOURS — which is what every scene saved
  // before this existed has, so an old library opens as a single collection of your own
  // with nothing to migrate.
  //
  // Loading someone's published scenes installs them UNDER THEIR NAME instead of merging
  // into your library, so the two never mix, a name collision between your "Sunset" and
  // theirs is not a collision at all, and re-loading the same profile replaces just their
  // set (see applyRestore's collection branch).
  //
  // The field is deliberately NOT part of snapshotScene: it labels where a scene came from,
  // not what it renders, so it rides beside `name` and applyPreset never reads it.
  const collectionOf = p => (p && typeof p.collection === "string" && p.collection.trim()) || "";
  // Whether a scene is in the AUTO-CYCLE ROTATION — the tick beside it in the scene list.
  // Unticked scenes are still perfectly selectable by hand; they are just skipped when
  // "Auto-cycle scenes" is running, so you can build a show out of a subset of your library.
  //
  // Stored as `rotate` beside `name`/`collection`, and ABSENT MEANS IN — so every scene saved,
  // shared, backed up or published before this existed keeps cycling exactly as it did, with
  // nothing to migrate. Only an explicit `false` excludes. Same backward-compatibility
  // discipline as `layers` being omitted for a one-item stack.
  //
  // Like `collection` it is deliberately NOT part of snapshotScene: it says how a scene is
  // USED, not what it renders, and applyPreset never reads it (presetprobe would flag it).
  // And like `collection` it MUST be listed explicitly in validatePresetList, which rebuilds
  // each preset from an object literal — a field missing from there is silently dropped on
  // every cloud load and gallery install.
  const inRotation = p => !(p && p.rotate === false);
  // Your own group is labelled with YOUR name, so the list reads "Erbsman / dyze".
  //
  // It used to fall back to "My scenes", and that fallback was visible in the worst possible
  // way: #cloud-name is filled by cloudFetchProfileMeta, a network round trip, so the first
  // paint said "My scenes" and the label only became "Erbsman" the next time anything rebuilt
  // the list — clicking the group to open it. A heading that renames itself when you touch it
  // reads as a bug, because it is one.
  //
  // Two fixes, and BOTH are needed. The name is cached in its own localStorage key and read
  // SYNCHRONOUSLY here, so the very first build already has it and there is nothing to flip;
  // and setProfileName() rebuilds the list whenever the name actually changes, which covers
  // the first-ever sign-in and a rename, where no cache can help.
  //
  // The key is deliberately its own, not part of cloudSess: this is what to call your local
  // library, so it outlives a sign-out. Same per-browser class as the credits preference.
  const PROFILE_NAME_KEY = "burnTheWeb.profile.v1";
  // TWO different defaults, because the two places had two different jobs and sharing one
  // string served neither well.
  //
  // DEFAULT_PROFILE_NAME is what cloudSave PUBLISHES under when you never named your profile —
  // it has to read as somebody's name in the public gallery, so it stays the app's name.
  //
  // DEFAULT_LIBRARY_LABEL is only the heading over your own group in the scene list before you
  // have a profile name. "burnTheWeb" there just named the app back at you; "Default scenes"
  // says what the group actually holds on a fresh install. Setting a profile name replaces it
  // either way, so this is the pre-account label and nothing more.
  const DEFAULT_PROFILE_NAME = "burnTheWeb";
  const DEFAULT_LIBRARY_LABEL = "Default scenes";
  function storedProfileName() {
    try { return (localStorage.getItem(PROFILE_NAME_KEY) || "").trim(); } catch (e) { return ""; }
  }
  // The live field wins (it is the value store, and may hold an edit not yet committed), then
  // the cache. Returns "" when there is genuinely no name — callers that need a *label*
  // add the default, callers that need an *author* drop it (see sceneTitleFor).
  function myProfileName() {
    const n = el("cloud-name");
    return (n && (n.value || "").trim()) || storedProfileName();
  }
  function myCollectionLabel() { return myProfileName() || DEFAULT_LIBRARY_LABEL; }
  // The one way the name is set. Writes the field (still the value store), caches it, and
  // rebuilds the scene list so the heading follows immediately rather than at the next
  // incidental rebuild.
  function setProfileName(v) {
    const name = (v || "").trim().slice(0, 40);
    const n = el("cloud-name");
    if (n) n.value = name;
    try {
      if (name) localStorage.setItem(PROFILE_NAME_KEY, name);
      else localStorage.removeItem(PROFILE_NAME_KEY);
    } catch (e) { /* private mode — the name just won't survive the reload */ }
    buildPresetList();
  }
  // Arm the on-screen scene title for preset `i`: its name, and the account that made it.
  //
  // The author is `collection` — the published profile a scene came from, stamped on by the
  // gallery install. Absent means it is one of YOURS, so it falls back to your cloud profile
  // name; with no profile there is no account to name and the title shows the scene name
  // alone. Deliberately NOT myCollectionLabel(), whose "Default scenes" fallback is a list heading
  // and would read as an author here.
  //
  // Declared here rather than inline in applyPreset ON PURPOSE: presetprobe slices
  // `function applyPreset(` … `function createPreset(` and greps that body for `p.<field>`
  // reads, asserting each is a field snapshotScene captures. `name` and `collection` are not
  // (a preset's label and its provenance are not what it renders), so reading them in there
  // would go red — correctly. Taking the INDEX keeps applyPreset's body clean.
  function sceneTitleFor(i) {
    const p = presets[i]; if (!p) return;
    // myProfileName(), NOT myCollectionLabel(): with no profile there is no account to name,
    // and crediting a scene to "burnTheWeb" is noise. The dash goes with the empty author.
    showSceneTitle(p.name, collectionOf(p) || myProfileName());
  }
  // Groups in a stable order: yours always first (and always present, even while empty, so
  // there is somewhere obvious for New to land), then each collection by first appearance.
  function presetGroups() {
    const groups = [], byKey = new Map();
    const add = key => {
      let g = byKey.get(key);
      if (!g) { g = { key, label: key || myCollectionLabel(), items: [] }; byKey.set(key, g); groups.push(g); }
      return g;
    };
    add("");
    presets.forEach((p, i) => add(collectionOf(p)).items.push({ p, i }));
    return groups;
  }
  // Which groups are expanded. Transient and starting EMPTY, so every collection is folded
  // on load and the list opens as a short stack of names — the requested default. Surviving
  // rebuilds is what stops a pick from folding the group you are working in.
  const openCollections = new Set();
  // The heading under the Scene box that names what you are editing. Called from
  // buildPresetList rather than from each selection path, because that function is already
  // the one choke point every path goes through to move the highlight (create, rename,
  // delete, restore, a manual pick, and the auto-cycle via applyPreset) — so the title
  // cannot drift from the selection without the highlight drifting too.
  function syncSceneTitle() {
    const h = el("scenenow");
    if (!h) return;
    // Something is always selected (see ensureSelection), so there is no "nothing" branch.
    // The || is a belt-and-braces read for the window during startup before ensureSelection
    // has run, not a state the user can reach.
    const p = presets[curPreset] || presets[0];
    if (!p) return;
    h.textContent = p.name;
    // Whose scene it is, when it came from someone else's collection — the same fact the
    // on-screen banner gives you, kept visible while you work rather than for four seconds.
    const from = collectionOf(p);
    h.title = from ? p.name + " — from " + from : p.name;
  }
  function buildPresetList() {
    syncSceneTitle();
    const host = el("presetlist");
    if (!host) return;
    presetSel.style.display = "none";       // the <select> is the value store, not the control
    host.textContent = "";
    // Every .pl-scene in here is now a real saved scene. The list used to open with an
    // "— unsaved scene —" row that also carried .pl-scene, so anything counting that class to
    // count scenes was off by one; it isn't any more.
    for (const g of presetGroups()) {
      const sec = document.createElement("div");
      sec.className = "pl-grp" + (openCollections.has(g.key) ? " open" : "");
      const head = document.createElement("button");
      head.type = "button";
      head.className = "pl-head";
      head.title = (openCollections.has(g.key) ? "Collapse" : "Expand") + " “" + g.label + "”";
      const nm = document.createElement("span");
      nm.className = "pl-nm"; nm.textContent = g.label;
      const ct = document.createElement("span");
      ct.className = "pl-ct"; ct.textContent = String(g.items.length);
      head.appendChild(nm); head.appendChild(ct);
      head.addEventListener("click", () => {
        if (openCollections.has(g.key)) openCollections.delete(g.key); else openCollections.add(g.key);
        buildPresetList();
      });
      sec.appendChild(head);
      // Someone else's collection can be dropped whole. Without this the only way to undo a
      // gallery load would be deleting their scenes one at a time; your own group has no ✕
      // because it is not a thing you loaded.
      if (g.key) {
        const rm = document.createElement("button");
        rm.type = "button"; rm.className = "pl-drop"; rm.textContent = "✕";
        rm.title = "Remove the “" + g.label + "” collection — your own scenes are untouched";
        rm.addEventListener("click", e => { e.stopPropagation(); dropCollection(g.key, g.label); });
        sec.appendChild(rm);
      }
      const body = document.createElement("div");
      body.className = "pl-body";
      if (!g.items.length) {
        const e = document.createElement("div");
        e.className = "pl-empty"; e.textContent = "no scenes yet — New saves one here";
        body.appendChild(e);
      }
      for (const { p, i } of g.items) {
        // A row, not a bare button: a checkbox cannot live INSIDE a <button> (nested
        // interactive content), so the tick and the name-button are siblings under .pl-row.
        // Same shape as .pl-grp holding .pl-head + .pl-drop.
        const row = document.createElement("div");
        row.className = "pl-row";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "pl-cyc";
        cb.checked = inRotation(p);
        cb.title = "Include “" + p.name + "” when Auto-cycle scenes is on";
        cb.setAttribute("aria-label", "Auto-cycle " + p.name);
        // Ticking must NOT select the scene — that is the whole point of it being a separate
        // hit target — so the click is stopped from reaching the row.
        cb.addEventListener("click", e => e.stopPropagation());
        cb.addEventListener("change", () => setRotation(i, cb.checked));
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pl-scene" + (i === curPreset ? " on" : "");
        b.textContent = p.name;
        b.title = g.key ? p.name + " — from " + g.label : p.name;
        b.addEventListener("click", () => pickPreset(i));
        row.appendChild(cb); row.appendChild(b);
        body.appendChild(row);
      }
      sec.appendChild(body);
      host.appendChild(sec);
    }
  }
  // Tick / untick one scene's place in the auto-cycle rotation.
  //
  // It writes `rotate` ONLY when excluding and deletes the key when including, so a library
  // where everything is ticked serialises exactly as it did before the feature — no key, no
  // diff in any saved scene, share link, backup or cloud profile.
  //
  // persist() only, deliberately NOT autosavePreset(): the tick is a property of the scene in
  // your library, not of the scene on screen, and folding it into the SELECTED preset would
  // write the wrong one every time you ticked a different row. It also must not disturb
  // curPreset or the picture — unticking the scene you are watching leaves it on screen and
  // simply stops the cycler coming back to it.
  function setRotation(i, on) {
    const p = presets[i]; if (!p) return;
    if (on) delete p.rotate; else p.rotate = false;
    buildPresetList();     // the row is rebuilt, so the tick reflects what is stored
    persist();
  }
  // Every pick routes through the <select>'s change event, so applyPreset, dockAll, the
  // autosave and persist all run exactly as a native dropdown pick did. The swatch picker
  // does the same thing for palettes, and for the same reason: no second code path.
  function pickPreset(i) {
    presetSel.value = String(i);
    presetSel.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function dropCollection(key, label) {
    const n = presets.filter(p => collectionOf(p) === key).length;
    if (!confirm("Remove the “" + label + "” collection?\n\n" + n + " scene" + (n === 1 ? "" : "s")
      + " will be deleted. Your own scenes are not touched.")) return;
    // Re-find the selection by IDENTITY afterwards: every index above the removed run
    // shifts, so keeping the old number would silently select someone else's scene.
    const cur = presets[curPreset];
    const at = curPreset;
    presets = presets.filter(p => collectionOf(p) !== key);
    openCollections.delete(key);
    const kept = cur ? presets.indexOf(cur) : -1;
    if (kept >= 0) {                  // the scene we were on survived — leave the picture alone
      curPreset = kept;
      rebuildPresetOptions();
      persist();
      return;
    }
    // It went with the collection, so a neighbour is selected — and it must be APPLIED, not
    // merely highlighted. Selecting without applying leaves the deleted scene on screen under
    // a name that now belongs to a different scene, and the next slider move autosaves it over
    // that scene. See the same reasoning on Delete.
    ensureSelection();
    curPreset = Math.min(at, presets.length - 1);
    applyPreset(curPreset);
    rebuildPresetOptions();
    persist();
  }
  // Normalize a saved state to the current slider set: keep only keys that still
  // exist (drops retired ones like `radius`) and default any newly-added keys.
  function mergeState(e, saved) {
    const base = presetState(e);
    if (saved) for (const id in base) {
      const v = saved[id]; if (v === undefined) continue;
      base[id] = Array.isArray(base[id]) ? (Array.isArray(v) ? v.slice() : base[id]) : v;
    }
    return base;
  }
  // ...and for its beat-chip map. This was the one loader that copied verbatim, which
  // left `beatStates[e][id]` undefined for any control the preset predates. loadBeat
  // spread that into `{}`, and `syncChips`'s classList.toggle(…, undefined) *flips*
  // the class rather than clearing it (per the DOM spec an explicit undefined counts
  // as "force not supplied"), so the chip inverted on every load while the slider was
  // never actually armed. Merging here is the fix; syncChips coerces as a backstop.
  function mergeBeat(e, saved) {
    const base = presetBeat(e);
    if (saved) for (const id in base) {
      const b = saved[id]; if (!b) continue;
      for (const band of ["low", "mid", "high"]) if (typeof b[band] === "boolean") base[id][band] = b[band];
    }
    return base;
  }
  // Same normalization for a preset's pulse-shape map: keep known ids/keys, default
  // the rest — so presets saved before pulse shapes existed (no `pulse`) still load.
  function mergePulse(e, saved) {
    const base = presetPulse(e);
    if (saved) for (const id in base) if (typeof saved[id] === "string" && PULSE_FN[saved[id]]) base[id] = saved[id];
    return base;
  }
  // ...and for its pulse lengths (no `plen` ⇒ every slider at PULSE_DROP).
  function mergePlen(e, saved) {
    const base = presetPlen(e);
    if (saved) for (const id in base) if (plenOk(saved[id])) base[id] = saved[id];
    return base;
  }
  // ---- the stack in a preset / blob ------------------------------------------
  // A stack rides as an OPTIONAL `layers` array. When it holds one item nothing is
  // emitted at all (see stackOut), so every scene saved, shared or backed up before
  // this feature — and every one saved after it that doesn't stack — is byte-for-byte
  // what it always was. Backward compatibility by construction rather than by testing,
  // the same discipline as "?s= decodes forever".
  // Function declarations, NOT const arrows: mergeLayers runs from applyBlob during
  // restore(), which is hundreds of lines above this block, so a const would be in the
  // temporal dead zone and throw. That aborts the rest of startup, and the symptom you
  // actually see is a later TDZ error on `nextSwitch` inside frame() — this file has
  // been bitten by the same shape before (see `card` and `beatUi`, both var for it).
  function blendOk(v) { return BLEND_BY_ID[v] ? v : "max"; }
  function gainOk(v) { return (typeof v === "number" && isFinite(v)) ? Math.min(1, Math.max(0, v)) : 1; }
  // One item, with its effect as the stable string id (converted at the storage edge
  // like every other effect reference). The selected item's values live in the DOM, so
  // freeze first — a caller that forgets loses the user's most recent edit.
  function stackItemOut(L) {
    const { state, cam } = splitLayerCam(L.state || {});   // camera → its own per-layer `cam` node
    return { effect: effectId(L.fx), state, cam, beat: L.beat, pulse: L.pulse,
      plen: L.plen, palette: L.palette, paletteRev: L.paletteRev, paletteBg: L.paletteBg,
      seedPath: L.seedPath, seedRide: L.seedRide, seedPts: L.seedPts, ranges: L.ranges,
      showBox: L.showBox, filters: L.filters, blend: L.blend, gain: L.gain, mute: !!L.mute };
  }
  function stackOut() {
    if (stack.length <= 1) return null;          // one item ⇒ emit nothing
    freezeItem(stack[stackSel]);
    const out = stack.map(stackItemOut);
    thawItem(stack[stackSel]);                   // put the selected item back on the DOM
    return out;
  }
  // Rebuild a stack from a preset/blob. Falls back to a single item described by the
  // legacy top-level fields, which is exactly what a pre-feature preset carries.
  function mergeLayers(p) {
    const raw = Array.isArray(p.layers) ? p.layers.slice(0, STACK_MAX) : null;
    const out = [];
    for (const r of (raw || [])) {
      if (!r) continue;
      const e = typeof r.effect === "number" ? r.effect : effectIndexFromId(r.effect);
      if (e < 0 || !EFFECTS[e]) continue;        // effect no longer ships: drop, never misfile
      const L = newStackItem(e);
      // Each item merges against ITS OWN effect. Merging one item's state against a
      // different effect's defaults silently drops every key that effect declares.
      // The camera rides in a sibling `cam` node now — fold it back into state first (a
      // pre-grouping scene has the keys inline in r.state and no r.cam, which joinLayerCam
      // passes through unchanged).
      L.state = mergeState(e, joinLayerCam(r.state, r.cam));
      L.beat = mergeBeat(e, r.beat);
      L.pulse = mergePulse(e, r.pulse);
      L.plen = mergePlen(e, r.plen);
      // Per-layer palette + filters. Absent (a scene saved before this) ⇒ fall back to
      // the scene's top-level extra, which is what every layer shared before — so an old
      // stacked scene still loads looking the way it did. null ⇒ applyLayerExtras defaults
      // it from the effect. `p.extra` exists on a preset; a blob has no top-level extra,
      // and its per-effect extras (already installed) are the fallback applyLayerExtras uses.
      const tex = p.extra || {};
      L.palette = r.palette != null ? r.palette : (tex.palette != null ? tex.palette : null);
      L.paletteRev = r.paletteRev != null ? !!r.paletteRev : (tex.paletteRev != null ? !!tex.paletteRev : null);
      L.paletteBg = r.paletteBg != null ? bgOk(r.paletteBg) : (tex.paletteBg != null ? bgOk(tex.paletteBg) : null);
      L.seedPath = r.seedPath != null ? seedModeOk(r.seedPath) : (tex.seedPath != null ? seedModeOk(tex.seedPath) : null);
      L.seedRide = r.seedRide != null ? r.seedRide !== false : (tex.seedRide != null ? tex.seedRide !== false : null);
      L.seedPts = r.seedPts != null ? seedPtsOk(r.seedPts) : (tex.seedPts != null ? seedPtsOk(tex.seedPts) : null);
      L.showBox = r.showBox != null ? !!r.showBox : (tex.showBox != null ? !!tex.showBox : null);
      const fset = filtersOk(r.filters) || filtersOk(tex.filters);
      // orderFilters, NOT FILTERS.filter: the stored list is the USER'S drag order and the
      // chain is a sequence, not a sorted set — re-sorting it here threw the order away on
      // every reload, and since the heat/image split is positional that changed what the
      // scene RENDERED, not just how the list looked. Exactly the bug mergeExtra was fixed
      // for; filtersOk already dropped unknowns and duplicates, and a Set iterates in
      // insertion order, so this preserves what was saved.
      L.filters = fset ? orderFilters([...fset]).map(f => f.id) : null;
      // Per-layer slider bounds. Absent (a scene saved before this) ⇒ migrate the scene's
      // global ranges' per-layer entries onto every layer, so an old stacked scene keeps its
      // widened sliders (all layers share them until you retune one per-layer).
      L.ranges = (r.ranges && typeof r.ranges === "object") ? r.ranges : layerRangesOf(p.ranges);
      L.blend = blendOk(r.blend);
      L.gain = gainOk(r.gain);
      L.mute = !!r.mute;
      out.push(L);
    }
    if (!out.length) {                           // pre-feature preset, or every item dropped
      const e = EFFECTS[p.effect] ? p.effect : 0;
      const L = newStackItem(e);
      L.state = mergeState(e, p.state); L.beat = mergeBeat(e, p.beat);
      L.pulse = mergePulse(e, p.pulse); L.plen = mergePlen(e, p.plen);
      const tex = p.extra || {};                 // the single layer takes the scene's palette + filters
      L.palette = tex.palette != null ? tex.palette : null;
      L.paletteRev = tex.paletteRev != null ? !!tex.paletteRev : null;
      L.paletteBg = tex.paletteBg != null ? bgOk(tex.paletteBg) : null;
      L.seedPath = tex.seedPath != null ? seedModeOk(tex.seedPath) : null;
      L.seedRide = tex.seedRide != null ? tex.seedRide !== false : null;
      L.seedPts = tex.seedPts != null ? seedPtsOk(tex.seedPts) : null;
      L.showBox = tex.showBox != null ? !!tex.showBox : null;
      const fset = filtersOk(tex.filters);
      L.filters = fset ? orderFilters([...fset]).map(f => f.id) : null;   // the user's order — see above
      L.ranges = layerRangesOf(p.ranges);        // the single layer takes the scene's per-layer bounds
      out.push(L);
    }
    return out;
  }
  // Install a rebuilt stack and select its first item. The caller runs setEffect after.
  // Every item inherits the CURRENT phase clocks rather than the fresh ones newStackItem
  // seeds: accumulated phase deliberately does not travel with a preset ("the same
  // configuration, not the same frame"), so applying one must not rewind simT/plasmaTime
  // and snap every animation back to its start. Items diverge from here as they run.
  function installStack(items) {
    const now = phaseSnapshot();
    for (const L of items) L.phase = Object.assign({}, now);
    stack = items;
    stackSel = 0;
    pointMaps(0);
    thawItem(stack[0]);
    // Every slot holds a DIFFERENT layer now, so every block has to be repainted. Missing
    // this is silent: the records are right, so the render is right and only the panel lies.
    // It lives here rather than in applyPreset so presetprobe's structural check — that
    // applyPreset reads no field snapshotScene does not capture — still holds by construction.
    repaintAllBlocks();
  }
  function applyPreset(i) {
    const p = presets[i]; if (!p) return;
    applyingPreset = true;
    // Start the transition BEFORE anything is swapped: it freezes the frame that is
    // still on screen, and picks its mode by comparing the outgoing scene to this one.
    transBegin(sceneInfo(p.effect, p.extra && p.extra.filters, p.extra && p.extra.palette,
      Array.isArray(p.layers) ? p.layers.map(r => effectIndexFromId(r && r.effect)) : null));
    const fromRamp = paletteBase.slice();   // the palette on screen right now — blend away from it
    // Bounds FIRST, matching applyBlob's ordering: loadState below assigns straight to
    // el.value, which the DOM silently clamps to the slider's current min/max — so a
    // stale bound would quietly rewrite the value we are about to install.
    applyRanges(p.ranges);
    // Scene TTL and Transition are deliberately NOT installed from the preset — they are
    // global, so picking a scene must not retune the show's pacing under you. Presets saved
    // while they were per-scene still carry `ttl`/`tdur`; ignoring them is the whole change.
    migrateSceneFx(p);   // pre-per-layer-filter preset: fold its whole-scene FX onto the layers
    migrateCam(p);                                // pre-per-layer preset: fold its one `cam` into p.state / p.layers before they merge
    installBeatTune(mergeBeatTune(p.beatTune));   // absent in pre-feature presets ⇒ shipped defaults
    states[p.effect] = mergeState(p.effect, p.state);
    beatStates[p.effect] = mergeBeat(p.effect, p.beat);      // p.beat may predate a control → default it
    pulseStates[p.effect] = mergePulse(p.effect, p.pulse);   // p.pulse absent in pre-feature presets → all snap
    plenStates[p.effect] = mergePlen(p.effect, p.plen);      // ...likewise p.plen → the default length
    if (p.sceneFx) writeSceneFx(sceneFxOk(p.sceneFx));       // scene-global Scene filters (absent ⇒ keep current)
    extras[p.effect] = mergeExtra(p.effect, p.extra);   // no p.extra.filters ⇒ the descriptor's
    // The stack, after applyRanges for the same reason the four maps are: every item's
    // values are validated against the live bounds. installStack thaws item 0, which
    // overwrites states[...] for its effect — so it must run before setEffect reads them.
    installStack(mergeLayers(p));
    effectSel.value = stack[0].fx;
    stageLayerExtras(stack[0]);       // before setEffect's persist, as when selecting a layer
    setEffect(stack[0].fx, false);    // loads the just-installed scene (may snap the palette)
    applyLayerExtras(stack[0]);        // slot 0's palette + filters go live (beginMorph blends to them)
    // Blend the palette in from whatever was on screen (fromRamp) rather than snapping.
    // WHERE it blends to depends on whether the palette cycle is running: with cycling on,
    // head for a fresh random palette and keep going — that is the whole point of cycling.
    // With it pinned (band tops out at 0) settle on the palette the preset actually stored,
    // or a preset could never show its own colours: this is a one-shot that morphStep ends
    // with setPalette(morphTargetIndex). That mattered the moment presets became portable —
    // a scene sent to someone else used to land on a random palette on arrival.
    morphOnce = !morphing;
    beginMorph(fromRamp, morphing ? pickOther(+paletteSel.value) : +paletteSel.value);
    curPreset = i; presetSel.value = String(i);
    buildPresetList();                 // move the highlight — covers the auto-cycle too,
    applyingPreset = false;            // which sets the value without firing `change`
    sceneTitleFor(i);                  // name the scene on screen (queues behind the credits)
    persist();
  }
  function createPreset() {           // save the current scene as a new preset
    // New nearly always means "a variation on the one I am editing", so it proposes that
    // scene's name with its version bumped. Something is always selected now, so the old
    // "nothing to vary" fallback is gone — but the read stays defensive, since createPreset is
    // reachable from a keyboard shortcut before the first paint.
    const cur = presets[curPreset];
    const suggest = bumpName(cur ? cur.name : "Scene " + presets.length);
    const name = (prompt("Scene name:", suggest) || "").trim();
    if (!name) return;
    presets.push({ name, ...snapshotScene() });
    curPreset = presets.length - 1;
    stopCycling();                    // ...and keep it on screen (see stopCycling)
    rebuildPresetOptions();
    persist();
  }
  // Bump a trailing version number: "Sunset" → "Sunset 2" → "Sunset 3". A trailing integer
  // IS the version, so it is incremented rather than appended to; anything else keeps its
  // text and gains a 2. A name that is nothing BUT digits ("2001") bumps as the number it
  // is, with no stem bolted on.
  // It also skips past names already in the library, so pressing New repeatedly from one
  // scene walks up instead of proposing the same name twice. That matters beyond tidiness:
  // a cloud/link merge resolves scenes BY NAME and overwrites the same-named one, so two
  // scenes called "Sunset 2" silently become one on the way back in.
  //
  // It sits BELOW createPreset (hoisted, so the call above still resolves) on purpose:
  // presetprobe slices `function applyPreset(` … `function createPreset(` as applyPreset's
  // body and greps it for `p.<field>` reads off a stored preset. Declared above, this
  // function's `p.name` lands in that slice and reads as applyPreset restoring a field
  // snapshotScene never captures — which is exactly what the probe went red on.
  function bumpName(name) {
    const m = /^(.*?)\s*(\d+)$/.exec(name);
    const stem = (m ? m[1] : name).trim();
    const make = k => stem ? stem + " " + k : String(k);
    let n = (m ? +m[2] : 1) + 1;
    while (presets.some(p => p.name === make(n))) n++;
    return make(n);
  }
  el("newpreset").addEventListener("click", createPreset);
  // When a preset is selected, edits flow straight back into it (auto-save); this
  // writes the current scene over the selected preset, keeping its name.
  // Fold the live scene back into the selected preset. Everything that rides BESIDE `name` —
  // the fields snapshotScene deliberately does not capture, because they are not what the
  // scene renders — has to be carried over by hand: spreading snapshotScene() over a bare
  // `{name}` silently dropped them on the first slider drag after selecting a scene.
  // `collection` losing that way quietly reassigned someone else's scene to you (it left
  // their collection and appeared under your name), and `rotate` losing that way put a scene
  // you had taken out of the show straight back into it.
  // There is no scratch mode any more, so this writes on every edit. The range check is a
  // guard for the startup window before ensureSelection has run, NOT a mode: if it ever
  // silently skips once the app is up, an edit has gone nowhere and that is a bug.
  function autosavePreset() {
    if (curPreset >= 0 && curPreset < presets.length) {
      const p = presets[curPreset];
      presets[curPreset] = { name: p.name, collection: p.collection, rotate: p.rotate, ...snapshotScene() };
    }
  }
  el("renamepreset").addEventListener("click", () => {
    if (curPreset < 0 || curPreset >= presets.length) return;
    const name = (prompt("Rename scene:", presets[curPreset].name) || "").trim();
    if (!name) return;
    presets[curPreset].name = name;
    rebuildPresetOptions();
    persist();
  });
  // Delete used to drop to "— unsaved scene —" and leave the deleted scene on screen, which
  // was safe precisely because nothing was selected to autosave into. With something always
  // selected that shortcut is destructive: highlight the neighbour without applying it and the
  // next slider move writes the scene you just deleted straight over the neighbour. So the
  // neighbour is APPLIED, and the picture changes — that is the visible cost of losing the
  // scratch mode, and it is the correct trade.
  //
  // Deleting the last scene re-seeds the shipped library rather than leaving an empty one:
  // "something is always selected" cannot hold over an empty list.
  el("delpreset").addEventListener("click", () => {
    if (curPreset < 0 || curPreset >= presets.length) return;
    const at = curPreset;
    presets.splice(at, 1);
    ensureSelection();                                  // re-seeds if that was the last one
    curPreset = Math.min(at, presets.length - 1);
    applyPreset(curPreset);
    rebuildPresetOptions();
    persist();
  });
  // The pop-out column is deliberately NOT emptied here, nor anywhere else. It used to be
  // docked on every scene change, on Delete, and on setEffect, on the reasoning that a new
  // scene swaps every slider out from under you so a leftover column is stale furniture.
  // That reasoning does not survive per-layer boxes: the moment two layers' boxes can sit
  // side by side, anything that empties the column takes away the comparison you opened it
  // for. A box whose control the new scene does not use hides itself (refreshBreakout) and
  // comes back if you return to an effect that has it, so nothing stale is ever shown.
  presetSel.addEventListener("change", () => {
    const i = +presetSel.value;
    // Every option is a real scene now, so there is no second branch: applyPreset repaints the
    // list and moves the highlight itself.
    if (i >= 0 && i < presets.length) applyPreset(i);
  });

