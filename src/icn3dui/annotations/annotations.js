/**
 * @author Jiyao Wang <wangjiy@ncbi.nlm.nih.gov> / https://github.com/ncbi/icn3d
 */
iCn3DUI.prototype.showAnnotations = function() { var me = this, ic = me.icn3d; "use strict";
    me.openDlg('dl_selectannotations', 'Sequences and Annotations');
    // add note about assembly
    if( (me.bAssemblyNote === undefined || !me.bAssemblyNote) && ic.asuCnt !== undefined ) {
        var html = "     <br><div id='" + me.pre + "assembly_note' style='margin-left:5px;'><span class='icn3d-annoLargeTitle'>Assembly Tips:</span> Only the asymmetric unit is shown in the sequence window.<br>Click \"Assembly\" in the menu \"View\" to switch between asymmetric unit and biological assembly (<b>" + ic.asuCnt + "</b> asymmetric unit).</div>";
        $("#" + me.pre + "dl_annotations_tabs").append(html);
        me.bAssemblyNote = true;
    }
    if(me.bAnnoShown === undefined || !me.bAnnoShown) {
        var chainArray = Object.keys(ic.chains);
        if(me.giSeq === undefined) me.giSeq = {};
        if(me.currClin === undefined) me.currClin = {};
        if(me.resi2disease_nonempty === undefined) me.resi2disease_nonempty = {};
        if(me.baseResi === undefined) me.baseResi = {};
        if(me.matchedPos === undefined) me.matchedPos = {};
        var dialogWidth = (me.cfg.notebook) ? me.WIDTH / 2 : $("#" + me.pre + "dl_selectannotations").dialog( "option", "width" );
        me.seqAnnWidth = dialogWidth - 120 - 30*2 - 50; // title: 120px, start and end resi: 30px, extra space on the left and right: 50px
        me.maxAnnoLength = 1;
        for(var chainid in ic.chainsSeq) {
            if(ic.chainsSeq[chainid].length > me.maxAnnoLength) {
                me.maxAnnoLength = ic.chainsSeq[chainid].length;
            }
        }
        var nucleotide_chainid = {}, chemical_chainid = {}, chemical_set = {};
        me.protein_chainid = {};
        for(var i = 0, il = chainArray.length; i < il; ++i) {
            var pos = Math.round(chainArray[i].indexOf('_'));
            //if(pos > 4) continue; // NMR structures with structure id such as 2K042,2K043, ...
            var atom = ic.getFirstCalphaAtomObj(ic.chains[chainArray[i]]);
            if(atom === undefined) atom = ic.getFirstAtomObj(ic.chains[chainArray[i]]);
            // only single letter chain has accession such as 1P9M_A
            var chainLetter = chainArray[i].substr(chainArray[i].indexOf('_') + 1);
            var chainidBase;
            if(chainLetter.indexOf('_') !== -1) { // NCBI modified chainid, e.g., A_1
                chainLetter = chainLetter.substr(0, chainLetter.indexOf('_'));
                chainidBase = chainArray[i].substr(0, chainArray[i].indexOf('_')) + '_' + chainLetter;
            }
            else {
                chainidBase = chainArray[i];
            }
            //if(me.cfg.mmdbid !== undefined) { // protein and chemicals/ions are in different chains
            if(ic.proteins.hasOwnProperty(atom.serial) && ic.chainsSeq[chainArray[i]].length > 1) {
                me.protein_chainid[chainArray[i]] = chainidBase;
            }
            else if(ic.nucleotides.hasOwnProperty(atom.serial) && ic.chainsSeq[chainArray[i]].length > 1) {
                nucleotide_chainid[chainArray[i]] = chainidBase;
            }
            else {
                if(ic.chainsSeq[chainArray[i]].length > 1) {
                    chemical_chainid[chainArray[i]] = chainidBase;
                }
                else {
                    var name = ic.chainsSeq[chainArray[i]][0].name;
                    var resid = chainArray[i] + '_' + ic.chainsSeq[chainArray[i]][0].resi;
                    if(chemical_set[name] === undefined) chemical_set[name] = [];
                    chemical_set[name].push(resid);
                }
            }
            //}
            // protein and nucleotide chain may have chemicals/ions attached at the end
            if( (me.cfg.pdbid !== undefined || me.cfg.opmid !== undefined || me.cfg.mmcifid !== undefined || me.cfg.mmtfid !== undefined)
              && (ic.proteins.hasOwnProperty(atom.serial) || ic.nucleotides.hasOwnProperty(atom.serial)) ) {
                for(var r = 0, rl = ic.chainsSeq[chainArray[i]].length; r < rl; ++r) {
                    var resObj = ic.chainsSeq[chainArray[i]][r];
                    if(resObj.name !== '' && resObj.name !== '-' && resObj.name == resObj.name.toUpperCase()) {
                        var resid = chainArray[i] + '_' + resObj.resi;
                        var atom = ic.getFirstCalphaAtomObj(ic.residues[resid]);
                        if(atom === undefined) atom = ic.getFirstAtomObj(ic.chains[chainArray[i]]);
                        if(ic.proteins.hasOwnProperty(atom.serial) || ic.nucleotides.hasOwnProperty(atom.serial)) {
                            continue;
                        }
                        else {
                            var name = resObj.name.trim();
                            if(chemical_set[name] === undefined) chemical_set[name] = [];
                            chemical_set[name].push(resid);
                        }
                    } // if(resObj.name !== ''
                } // for(var r = 0
            } // if(me.cfg.mmdbid
        } // for(var i = 0
        if(me.cfg.blast_rep_id === undefined) {
           if(me.bFullUi) {
               if(me.cfg.mmtfid !== undefined) { // mmtf data do NOT have the missing residues
                   var id = chainArray[0].substr(0, chainArray[0].indexOf('_'));
                   $.when(me.downloadMmcifSymmetry(id, 'mmtfid')).then(function() {
                       me.showAnnoSeqData(nucleotide_chainid, chemical_chainid, chemical_set);
                   });
               }
               else {
                   me.showAnnoSeqData(nucleotide_chainid, chemical_chainid, chemical_set);
               }
           }
        }
        else if(me.cfg.blast_rep_id !== undefined) { // align sequence to structure
           var url = me.baseUrl + 'pwaln/pwaln.fcgi?from=querytarget';
           var dataObj = {'targets': me.cfg.blast_rep_id, 'queries': me.cfg.query_id};
           if(me.cfg.query_from_to !== undefined ) {
               // convert from 1-based to 0-based
               var query_from_to_array = me.cfg.query_from_to.split(':');
               for(var i = 0, il = query_from_to_array.length; i < il; ++i) {
                   query_from_to_array[i] = parseInt(query_from_to_array[i]) - 1;
               }
               dataObj['queries'] = me.cfg.query_id + ':' + query_from_to_array.join(':');
           }
           if(me.cfg.target_from_to !== undefined) {
               // convert from 1-based to 0-based
               var target_from_to_array = me.cfg.target_from_to.split(':');
               for(var i = 0, il = target_from_to_array.length; i < il; ++i) {
                   target_from_to_array[i] = parseInt(target_from_to_array[i]) - 1;
               }
               dataObj['targets'] = me.cfg.blast_rep_id + ':' + target_from_to_array.join(':');
           }
           $.ajax({
              url: url,
              type: 'POST',
              data : dataObj,
              dataType: 'jsonp',
              //dataType: 'json',
              tryCount : 0,
              retryLimit : 1,
              success: function(data) {
                me.seqStructAlignData = data;
                me.showAnnoSeqData(nucleotide_chainid, chemical_chainid, chemical_set);
              },
              error : function(xhr, textStatus, errorThrown ) {
                this.tryCount++;
                if (this.tryCount <= this.retryLimit) {
                    //try again
                    $.ajax(this);
                    return;
                }
                return;
              }
            });
        } // align seq to structure
    }
    me.bAnnoShown = true;
};
iCn3DUI.prototype.showAnnoSeqData = function(nucleotide_chainid, chemical_chainid, chemical_set) { var me = this, ic = me.icn3d; "use strict";
    me.getAnnotationData();
    var i = 0;
    for(var chain in nucleotide_chainid) {
        me.getSequenceData(chain, nucleotide_chainid[chain], 'nucleotide', i);
        ++i;
    }
    me.interactChainbase = ic.unionHash(me.interactChainbase, me.protein_chainid);
    me.interactChainbase = ic.unionHash(me.interactChainbase, nucleotide_chainid);
    i = 0;
    for(var chain in chemical_chainid) {
        me.getSequenceData(chain, chemical_chainid[chain], 'chemical', i);
        ++i;
    }
    me.interactChainbase = ic.unionHash(me.interactChainbase, chemical_chainid);
    me.ssbondChainbase = ic.unionHash(me.ssbondChainbase, me.protein_chainid);
    me.ssbondChainbase = ic.unionHash(me.ssbondChainbase, chemical_chainid);
    me.crosslinkChainbase = ic.unionHash(me.crosslinkChainbase, me.protein_chainid);
    me.crosslinkChainbase = ic.unionHash(me.crosslinkChainbase, nucleotide_chainid);
    me.crosslinkChainbase = ic.unionHash(me.crosslinkChainbase, chemical_chainid);
    for(var name in chemical_set) {
        me.getCombinedSequenceData(name, chemical_set[name], i);
        ++i;
    }
    me.enableHlSeq();
    setTimeout(function(){
      me.hideAllAnno();
      me.clickCdd();
    }, 0);
};
iCn3DUI.prototype.enableHlSeq = function() { var me = this, ic = me.icn3d; "use strict";
    if(! me.isMobile()) {
        me.selectSequenceNonMobile();
    }
    else {
        me.selectSequenceMobile();
        me.selectChainMobile();
    }
    // highlight seq after the ajax calls
    if(Object.keys(ic.hAtoms).length < Object.keys(ic.dAtoms).length) {
        me.updateHlSeq();
    }
};
// by default, showSeq and showCddSite are called at showAnnotations
// the following will be called only when the annotation is selected: showSnpClinvar, showDomain, showInteraction
// showSnpClinvar and showDomain will loop through me.protein_chainid
// showInteraction will loop through me.interactChainbase
iCn3DUI.prototype.updateClinvar = function() { var me = this, ic = me.icn3d; "use strict";
    if(me.bClinvarShown === undefined || !me.bClinvarShown) {
        for(var chainid in me.protein_chainid) {
            var chainidBase = me.protein_chainid[chainid];
            me.showClinvar(chainid, chainidBase);
        }
    }
    me.bClinvarShown = true;
};
iCn3DUI.prototype.updateSnp = function() { var me = this, ic = me.icn3d; "use strict";
    if(me.bSnpShown === undefined || !me.bSnpShown) {
        for(var chainid in me.protein_chainid) {
            var chainidBase = me.protein_chainid[chainid];
            me.showSnp(chainid, chainidBase);
        }
    }
    me.bSnpShown = true;
};
iCn3DUI.prototype.updateDomain = function() { var me = this, ic = me.icn3d; "use strict";
    if(me.bDomainShown === undefined || !me.bDomainShown) {
        me.showDomainAll();
    }
    me.bDomainShown = true;
};
iCn3DUI.prototype.updateInteraction = function() { var me = this, ic = me.icn3d; "use strict";
    if(me.bInteractionShown === undefined || !me.bInteractionShown) {
        for(var chainid in me.interactChainbase) {
            var chainidBase = me.interactChainbase[chainid];
            me.showInteraction(chainid, chainidBase);
        }
    }
    me.bInteractionShown = true;
};
iCn3DUI.prototype.updateSsbond = function() { var me = this, ic = me.icn3d; "use strict";
    if(me.bSSbondShown === undefined || !me.bSSbondShown) {
        for(var chainid in me.ssbondChainbase) {
            var chainidBase = me.ssbondChainbase[chainid];
            me.showSsbond(chainid, chainidBase);
        }
    }
    me.bSSbondShown = true;
};
iCn3DUI.prototype.updateCrosslink = function() { var me = this, ic = me.icn3d; "use strict";
    if(me.bCrosslinkShown === undefined || !me.bCrosslinkShown) {
        for(var chainid in me.crosslinkChainbase) {
            var chainidBase = me.crosslinkChainbase[chainid];
            me.showCrosslink(chainid, chainidBase);
        }
    }
    me.bCrosslinkShown = true;
};
iCn3DUI.prototype.updateTransmem = function() { var me = this, ic = me.icn3d; "use strict";
    if(me.bTranememShown === undefined || !me.bTranememShown) {
        for(var chainid in me.protein_chainid) {
            var chainidBase = me.protein_chainid[chainid];
            me.showTransmem(chainid, chainidBase);
        }
    }
    me.bTranememShown = true;
};
iCn3DUI.prototype.getAnDiv = function(chnid, anno) { var me = this, ic = me.icn3d; "use strict";
    var message = 'Loading ' + anno + '...';
    if(anno == 'custom') {
        message = ''
    }
    else if(anno == 'domain') {
        message = 'Loading 3D ' + anno + '...';
    }
    return "<div id='" + me.pre + anno + "_" + chnid + "'><div id='" + me.pre + "tt_" + anno + "_" + chnid + "' class='icn3d-fixed-pos' style='display:none!important'></div><div id='" + me.pre + "dt_" + anno + "_" + chnid + "' style='display:none'>" + message + "</div><div id='" + me.pre + "ov_" + anno + "_" + chnid + "'>" + message + "</div></div>";
};
iCn3DUI.prototype.addButton = function(chnid, classvalue, name, desc, width, buttonStyle) { var me = this, ic = me.icn3d; "use strict";
    return "<div class='" + classvalue + "' chainid='" + chnid + "' style='display:inline-block; font-size:11px; font-weight:bold; width:" + width + "px!important;'><button style='-webkit-appearance:" + buttonStyle + "; height:18px; width:" + width + "px;'><span style='white-space:nowrap; margin-left:-3px;' title='" + desc + "'>" + name + "</span></button></div>";
};
iCn3DUI.prototype.addSnpButton = function(snp, classvalue, name, desc, width, buttonStyle) { var me = this, ic = me.icn3d; "use strict";
    return "<div class='" + me.pre + classvalue + "' snp='" + snp + "' style='margin:3px 0 3px 0; display:inline-block; font-size:11px; font-weight:bold; width:" + width + "px!important;'><button style='-webkit-appearance:" + buttonStyle + "; height:18px; width:" + width + "px;'><span style='white-space:nowrap; margin-left:-3px;' title='" + desc + "'>" + name + "</span></button></div>";
};
iCn3DUI.prototype.conservativeReplacement = function(resA, resB) { var me = this, ic = me.icn3d; "use strict";
    var iA = (me.b62ResArray.indexOf(resA) !== -1) ? me.b62ResArray.indexOf(resA) : me.b62ResArray.length - 1; // or the last one "*"
    var iB = (me.b62ResArray.indexOf(resB) !== -1) ? me.b62ResArray.indexOf(resB) : me.b62ResArray.length - 1; // or the last one "*"
    var matrixValue = me.b62Matrix[iA][iB];
    if(matrixValue > 0) {
        return true;
    }
    else {
        return false;
    }
};
iCn3DUI.prototype.getColorhexFromBlosum62 = function(resA, resB) { var me = this, ic = me.icn3d; "use strict";
    var iA = (me.b62ResArray.indexOf(resA) !== -1) ? me.b62ResArray.indexOf(resA) : me.b62ResArray.length - 1; // or the last one "*"
    var iB = (me.b62ResArray.indexOf(resB) !== -1) ? me.b62ResArray.indexOf(resB) : me.b62ResArray.length - 1; // or the last one "*"
    var matrixValue = me.b62Matrix[iA][iB];
    if(matrixValue === undefined) return '333333';
    // range and color: blue for -4 ~ 0, red for 0 ~ 11
    // max value 221 to avoid white
    var color = '333333';
    if(matrixValue > 0) {
        var c = 221 - parseInt(matrixValue / 11.0 * 221);
        var cStr = (c < 10) ? '0' + c.toString(16) : c.toString(16);
        color = 'DD' + cStr + cStr;
    }
    else {
        var c = 221 - parseInt(-1.0 * matrixValue / 4.0 * 221);
        var cStr = (c < 10) ? '0' + c.toString(16) : c.toString(16);
        color = cStr + cStr + 'DD';
    }
    return color;
};
iCn3DUI.prototype.processSeqData = function(chainid_seq) { var me = this, ic = me.icn3d; "use strict";
    for(var chnid in me.protein_chainid) {
        var chnidBase = me.protein_chainid[chnid];
        //if(chainid_seq.hasOwnProperty(chnid)) {
        //    var allSeq = chainid_seq[chnid];
        if(chainid_seq.hasOwnProperty(chnidBase)) {
            var allSeq = chainid_seq[chnidBase];
            me.giSeq[chnid] = allSeq;
            // the first 10 residues from sequences with structure
            var startResStr = '';
            for(var i = 0; i < 10 && i < ic.chainsSeq[chnid].length; ++i) {
                startResStr += ic.chainsSeq[chnid][i].name.substr(0, 1);
            }
            var pos = allSeq.toLowerCase().indexOf(startResStr.toLowerCase());
            if(pos == -1) {
                console.log("The gi sequence didn't match the protein sequence. The start of 3D protein sequence: " + startResStr + ". The gi sequence: " + allSeq.substr(0, 10) + ".");
                me.setAlternativeSeq(chnid, chnidBase);
            }
            else {
                me.matchedPos[chnid] = pos;
                me.baseResi[chnid] = ic.chainsSeq[chnid][0].resi - me.matchedPos[chnid] - 1;
            }
        }
        else {
            console.log( "No data were found for the protein " + chnid + "..." );
            me.setAlternativeSeq(chnid, chnidBase);
        }
        if(me.cfg.blast_rep_id != chnid) {
            me.showSeq(chnid, chnidBase);
        }
        else if(me.cfg.blast_rep_id == chnid && me.seqStructAlignData.data === undefined) {
          var title;
          if(me.cfg.query_id.length > 14) {
              title = 'Query: ' + me.cfg.query_id.substr(0, 6) + '...';
          }
          else {
              title = (isNaN(me.cfg.query_id)) ? 'Query: ' + me.cfg.query_id : 'Query: gi ' + me.cfg.query_id;
          }
          compTitle = undefined;
          compText = undefined;
          var text = "cannot be aligned";
          me.queryStart = '';
          me.queryEnd = '';
          alert('The sequence can NOT be aligned to the structure');
          me.showSeq(chnid, chnidBase, undefined, title, compTitle, text, compText);
        }
        else if(me.cfg.blast_rep_id == chnid && me.seqStructAlignData.data !== undefined) { // align sequence to structure
          //var title = 'Query: ' + me.cfg.query_id.substr(0, 6);
          var title;
          if(me.cfg.query_id.length > 14) {
              title = 'Query: ' + me.cfg.query_id.substr(0, 6) + '...';
          }
          else {
              title = (isNaN(me.cfg.query_id)) ? 'Query: ' + me.cfg.query_id : 'Query: gi ' + me.cfg.query_id;
          }
          var data = me.seqStructAlignData;
          var query, target;
          if(data.data !== undefined) {
              query = data.data[0].query;
              target = data.data[0].targets[chnid.replace(/_/g, '')];
              target = (target.hsps.length > 0) ? target.hsps[0] : undefined;
          }
          var text = '', compText = '';
          me.queryStart = '';
          me.queryEnd = '';
          var evalue;
          if(query !== undefined && target !== undefined) {
              evalue = target.scores.e_value.toPrecision(2);
              if(evalue > 1e-200) evalue = parseFloat(evalue).toExponential();
              var bitscore = target.scores.bit_score;
              var targetSeq = data.targets[chnid.replace(/_/g, '')].seqdata;
              var querySeq = query.seqdata;
              var segArray = target.segs;
              var target2queryHash = {};
              if(me.targetGapHash === undefined) me.targetGapHash = {};
              me.fullpos2ConsTargetpos = {};
              me.consrvResPosArray = [];
              var prevTargetTo = 0, prevQueryTo = 0;
              me.nTotalGap = 0;
              me.queryStart = segArray[0].from + 1;
              me.queryEnd = segArray[segArray.length - 1].to + 1;
              for(var i = 0, il = segArray.length; i < il; ++i) {
                  var seg = segArray[i];
                  if(i > 0) { // determine gap
                    if(seg.orifrom - prevTargetTo < seg.from - prevQueryTo) { // gap in target
                        me.targetGapHash[seg.orifrom] = {'from': prevQueryTo + 1, 'to': seg.from - 1};
                        me.nTotalGap += me.targetGapHash[seg.orifrom].to - me.targetGapHash[seg.orifrom].from + 1;
                    }
                    else if(seg.orifrom - prevTargetTo > seg.from - prevQueryTo) { // gap in query
                        for(var j = prevTargetTo + 1; j < seg.orifrom; ++j) {
                          target2queryHash[j] = -1; // means gap in query
                        }
                    }
                  }
                  for(var j = 0; j <= seg.orito - seg.orifrom; ++j) {
                      target2queryHash[j + seg.orifrom] = j + seg.from;
                  }
                  prevTargetTo = seg.orito;
                  prevQueryTo = seg.to;
              }
              // the missing residues at the end of the seq will be filled up in the API showNewTrack()
              var nGap = 0;
              ic.alnChainsSeq[chnid] = [];
              var offset = (ic.chainid2offset[chnid]) ? ic.chainid2offset[chnid] : 0;
              for(var i = 0, il = targetSeq.length; i < il; ++i) {
                  //text += me.insertGap(chnid, i, '-', true);
                  if(me.targetGapHash.hasOwnProperty(i)) {
                      for(var j = me.targetGapHash[i].from; j <= me.targetGapHash[i].to; ++j) {
                          text += querySeq[j];
                      }
                  }
                  compText += me.insertGap(chnid, i, '-', true);
                  if(me.targetGapHash.hasOwnProperty(i)) nGap += me.targetGapHash[i].to - me.targetGapHash[i].from + 1;
                  var pos = (ic.bUsePdbNum) ? i+1 + offset : i+1;
                  if(target2queryHash.hasOwnProperty(i) && target2queryHash[i] !== -1) {
                      text += querySeq[target2queryHash[i]];
                      var colorHexStr = me.getColorhexFromBlosum62(targetSeq[i], querySeq[target2queryHash[i]]);
                      if(targetSeq[i] == querySeq[target2queryHash[i]]) {
                          compText += targetSeq[i];
                          me.fullpos2ConsTargetpos[i + nGap] = {'same': 1, 'pos': pos, 'res': targetSeq[i], 'color': colorHexStr};
                          me.consrvResPosArray.push(pos);
                          ic.alnChainsSeq[chnid].push({'resi': pos, 'color': '#FF0000', 'color2': '#' + colorHexStr});
                      }
                      else if(me.conservativeReplacement(targetSeq[i], querySeq[target2queryHash[i]])) {
                          compText += '+';
                          me.fullpos2ConsTargetpos[i + nGap] = {'same': 0, 'pos': pos, 'res': targetSeq[i], 'color': colorHexStr};
                          me.consrvResPosArray.push(pos);
                          ic.alnChainsSeq[chnid].push({'resi': pos, 'color': '#0000FF', 'color2': '#' + colorHexStr});
                      }
                      else {
                          compText += ' ';
                          me.fullpos2ConsTargetpos[i + nGap] = {'same': -1, 'pos': pos, 'res': targetSeq[i], 'color': colorHexStr};
                          ic.alnChainsSeq[chnid].push({'resi': pos, 'color': me.GREYC, 'color2': '#' + colorHexStr});
                      }
                  }
                  else {
                      text += '-';
                      compText += ' ';
                  }
              }
              //title += ', E: ' + evalue;
          }
          else {
              text += "cannot be aligned";
              alert('The sequence can NOT be aligned to the structure');
          }
          var compTitle = 'BLAST, E: ' + evalue;
          me.showSeq(chnid, chnidBase, undefined, title, compTitle, text, compText);
          var residueidHash = {};
          var residueid;
          if(me.consrvResPosArray !== undefined) {
            for(var i = 0, il = me.consrvResPosArray.length; i < il; ++i) {
                residueid = chnidBase + '_' + me.consrvResPosArray[i];
                residueidHash[residueid] = 1;
                //atomHash = ic.unionHash(atomHash, ic.residues[residueid]);
            }
          }
          var prevHAtoms = ic.cloneHash(ic.hAtoms);
          //me.selectResidueList(residueidHash, chnidBase + '_blast', compTitle, false);
          me.selectResidueList(residueidHash, 'protein_aligned', compTitle, false);
          ic.hAtoms = ic.cloneHash(prevHAtoms);
        } // align seq to structure
    } // for loop
    me.enableHlSeq();
    // get CDD/Binding sites
    me.showCddSiteAll();
};
iCn3DUI.prototype.getAnnotationData = function() { var me = this, ic = me.icn3d; "use strict";
    var chnidBaseArray = $.map(me.protein_chainid, function(v) { return v; });
    var index = 0;
    for(var chnid in me.protein_chainid) {
        var buttonStyle = me.isMobile() ? 'none' : 'button';
        var fullProteinName = me.getProteinName(chnid);
        var proteinName = fullProteinName;
        //if(proteinName.length > 40) proteinName = proteinName.substr(0, 40) + "...";
        var categoryStr = (index == 0) ? "<span class='icn3d-annoLargeTitle'><b>Proteins</b>: </span><br><br>" : "";
        var geneLink = (ic.chainsGene[chnid] && ic.chainsGene[chnid].geneId) ? " (Gene: <a href='https://www.ncbi.nlm.nih.gov/gene/" + ic.chainsGene[chnid].geneId + "' target='_blank' title='" + ic.chainsGene[chnid].geneDesc + "'>" + ic.chainsGene[chnid].geneSymbol + "</a>)" : '';
        var chainHtml = "<div id='" + me.pre + "anno_" + chnid + "' class='icn3d-annotation'>" + categoryStr
            + "<span style='font-weight:bold;'>Annotations of " + chnid
            + "</span>: <a class='icn3d-blue' href='https://www.ncbi.nlm.nih.gov/protein?term="
            + chnid + "' target='_blank' title='" + fullProteinName + "'>" + proteinName + "</a>"
            + geneLink + "&nbsp;&nbsp;&nbsp;"
            + me.addButton(chnid, "icn3d-addtrack", "Add Track", "Add a custom track", 60, buttonStyle)
            + "&nbsp;&nbsp;&nbsp;";
        //if(me.cfg.blast_rep_id !== undefined && me.cfg.blast_rep_id == chnid) {
            chainHtml += me.addButton(chnid, "icn3d-customcolor", "Custom Color/Tube", "Use a custom file to define the colors or tubes in 3D structure", 110, buttonStyle) + "&nbsp;&nbsp;&nbsp;";
        //}
            chainHtml += me.addButton(chnid, "icn3d-helixsets", "Helix Sets", "Define sets for each helix in this chain and add them to the menu of \"Defined Sets\"", 60, buttonStyle) + "&nbsp;"
            + me.addButton(chnid, "icn3d-sheetsets", "Sheet Sets", "Define sets for each sheet in this chain and add them to the menu of \"Defined Sets\"", 60, buttonStyle) + "&nbsp;"
            + me.addButton(chnid, "icn3d-coilsets", "Coil Sets", "Define sets for each coil in this chain and add them to the menu of \"Defined Sets\"", 60, buttonStyle);
        $("#" + me.pre + "dl_annotations").append(chainHtml);
        var itemArray = ['giseq', 'cdd', 'clinvar', 'snp', 'domain', 'site', 'interaction', 'custom', 'ssbond', 'crosslink', 'transmem'];
        // dt: detailed view, hide by default; ov: overview, show by default
        for(var i in itemArray) {
            var item = itemArray[i];
            $("#" + me.pre + "anno_" + chnid).append(me.getAnDiv(chnid, item));
        }
        $("#" + me.pre + "anno_" + chnid).append("<br><hr><br>");
        ++index;
    }
    me.setToolTip();
    // show the sequence and 3D structure
    //var url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=protein&retmode=json&rettype=fasta&id=" + chnidBaseArray;
    var url = me.baseUrl + "/vastdyn/vastdyn.cgi?chainlist=" + chnidBaseArray;

    if(me.chainid_seq !== undefined) {
        me.processSeqData(me.chainid_seq);
    }
    else {
        $.ajax({
          url: url,
          dataType: 'jsonp', //'text',
          cache: true,
          tryCount : 0,
          retryLimit : 0, //1,
          success: function(data) {
            me.chainid_seq = data;
            me.processSeqData(me.chainid_seq);
          },
          error : function(xhr, textStatus, errorThrown ) {
            this.tryCount++;
            if (this.tryCount <= this.retryLimit) {
                //try again
                $.ajax(this);
                return;
            }
            me.enableHlSeq();
            console.log( "No data were found for the protein " + chnidBaseArray + "..." );
            for(var chnid in me.protein_chainid) {
                var chnidBase = me.protein_chainid[chnid];
                me.setAlternativeSeq(chnid, chnidBase);
                me.showSeq(chnid, chnidBase);
            }
            // get CDD/Binding sites
            me.showCddSiteAll();
            return;
          }
        });
    }
};
iCn3DUI.prototype.setAlternativeSeq = function(chnid, chnidBase) { var me = this, ic = me.icn3d; "use strict";
    //if(ic.chainsSeq[chnid] !== undefined) {
    var resArray = ic.chainsSeq[chnid];
    me.giSeq[chnid] = [];
    for(var i = 0, il = resArray.length; i < il; ++i) {
        var res = resArray[i].name;
        me.giSeq[chnid][i] = res;
    }
    me.matchedPos[chnid] = 0;
    me.baseResi[chnid] = ic.chainsSeq[chnid][0].resi - me.matchedPos[chnid] - 1;
};
iCn3DUI.prototype.getProteinName= function(chnid) { var me = this, ic = me.icn3d; "use strict";
    var fullProteinName = '';
    if( (me.cfg.mmdbid !== undefined || me.cfg.gi !== undefined || me.cfg.blast_rep_id !== undefined) && me.mmdb_data !== undefined) {
        var moleculeInfor = me.mmdb_data.moleculeInfor;
        var chain = chnid.substr(chnid.indexOf('_') + 1);
        for(var i in moleculeInfor) {
            if(moleculeInfor[i].chain == chain) {
                fullProteinName = moleculeInfor[i].name.replace(/\'/g, '&prime;');
                var proteinName = fullProteinName;
                //if(proteinName.length > 40) proteinName = proteinName.substr(0, 40) + "...";
                break;
            }
        }
    }
    else if((me.cfg.align !== undefined || me.cfg.chainalign !== undefined || me.bRealign || me.bSymd) && me.chainid2title !== undefined) {
        if(me.chainid2title[chnid] !== undefined) {
            fullProteinName = me.chainid2title[chnid];
        }
    }
    return fullProteinName;
};
iCn3DUI.prototype.getSequenceData = function(chnid, chnidBase, type, index) { var me = this, ic = me.icn3d; "use strict";
    var fullProteinName = me.getProteinName(chnid);
    var proteinName = fullProteinName;
    if(proteinName.length > 40) proteinName = proteinName.substr(0, 40) + "...";
    var categoryStr = "";
    if(index == 0) {
        if(type == 'protein') {
            categoryStr = "<span class='icn3d-annoLargeTitle'><b>Proteins</b>: </span><br><br>";
        }
        else if(type == 'nucleotide') {
            categoryStr = "<span class='icn3d-annoLargeTitle'><b>Nucleotides</b>: </span><br><br>";
        }
        else if(type == 'chemical') {
            categoryStr = "<span class='icn3d-annoLargeTitle'><b>Chemicals/Ions/Water</b>: </span><br><br>";
        }
    }
    $("#" + me.pre + "dl_annotations").append("<div id='" + me.pre + "anno_" + chnid + "' class='icn3d-annotation'>" + categoryStr + "<b>" + chnid + "</b>: " + "<span title='" + fullProteinName + "'>" + proteinName + "</span> </div>");
    // dt: detailed view, hide by default; ov: overview, show by default
    $("#" + me.pre + "anno_" + chnid).append(me.getAnDiv(chnid, 'giseq'));
    //$("#" + me.pre + "anno_" + chnid).append(me.getAnDiv(chnid, 'custom'));
    $("#" + me.pre + "anno_" + chnid).append(me.getAnDiv(chnid, 'interaction'));
    $("#" + me.pre + "anno_" + chnid).append("<br><hr><br>");
    // show the sequence and 3D structure
    me.giSeq[chnid] = [];

    for(var i = 0; i < ic.chainsSeq[chnid].length; ++i) {
        var res = ic.chainsSeq[chnid][i].name;
        //me.giSeq[chnid][i] = (res.length > 1) ? res.substr(0, 1) : res;
        me.giSeq[chnid][i] = res;
    }
    me.matchedPos[chnid] = 0;
    me.baseResi[chnid] = ic.chainsSeq[chnid][0].resi - me.matchedPos[chnid] - 1;
    me.showSeq(chnid, chnidBase, type);
    //me.showInteraction(chnid, chnidBase);
};
iCn3DUI.prototype.getCombinedSequenceData = function(name, residArray, index) { var me = this, ic = me.icn3d; "use strict";
    var categoryStr = (index == 0) ? "<span class='icn3d-annoLargeTitle'><b>Chemicals/Ions/Water</b>: </span><br><br>" : "";
    var chemName;
    var pos = residArray[0].lastIndexOf('_');
    var firstChainid = residArray[0].substr(0, pos);
    var sid = (me.cfg.mmdbid !== undefined && me.chainid2sid !== undefined) ? me.chainid2sid[firstChainid] : undefined;
    if(sid !== undefined) {
        chemName = "<b><a class='icn3d-blue' href='https://pubchem.ncbi.nlm.nih.gov/substance/" + sid + "#section=2D-Structure' target='_blank'>" + name + " <img src='https://pubchem.ncbi.nlm.nih.gov/image/imgsrv.fcgi?sid=" + sid + "'></a></b>";
    }
    else {
        chemName = "<b>" + name + "</b>";
    }
    $("#" + me.pre + "dl_annotations").append("<div id='" + me.pre + "anno_" + name + "' class='icn3d-annotation'>" + categoryStr + chemName + "</div>");
    // dt: detailed view, hide by default; ov: overview, show by default
    $("#" + me.pre + "anno_" + name).append("<div id='" + me.pre + "giseq_" + name + "'><div id='" + me.pre + "dt_giseq_" + name + "' style='display:none'></div><div id='" + me.pre + "ov_giseq_" + name + "'></div></div>");
    $("#" + me.pre + "anno_" + name).append("<br><hr><br>");
    // sequence, detailed view
    var htmlTmp = '<div id="' + me.pre + 'giseq_sequence" class="icn3d-dl_sequence">';
    var chainType = 'Chem.', chainTypeFull = 'Chemical';
    htmlTmp += '<div class="icn3d-seqTitle2" anno="sequence"><span style="white-space:nowrap;" title="' + chainTypeFull + ' ' + name + '">' + chainType + ' ' + name + '</span></div>';
    htmlTmp += '<span class="icn3d-residueNum" style="width:60px!important;" title="starting protein sequence number">Count: ' + residArray.length + '</span>';
    htmlTmp += '<span class="icn3d-seqLine">';
    // sequence, overview
    var html = htmlTmp;
    var html2 = htmlTmp;
    for(var i = 0, il = residArray.length; i < il; ++i) {
      var cFull = name;
      var c = cFull;
      if(cFull.length > 3) {
          c = cFull.substr(0,3);
      }
      if(i < residArray.length - 1) c = c + ',';
      var resid = residArray[i];
      var resi = resid.substr(resid.lastIndexOf('_') + 1);
      html += '<span id="giseq_' + me.pre + resid + '" title="' + cFull + resi + '" class="icn3d-residue icn3d-chemical">' + c + '</span>';
    }
    var color = me.GREY8;
    //html2 += '<div class="icn3d-seqTitle" style="display:inline-block; color:white; font-weight:bold; background-color:' + color + '; width:' + Math.round(me.seqAnnWidth * residArray.length / me.maxAnnoLength) + 'px;">' + name + '</div>';
    var width = Math.round(me.seqAnnWidth * residArray.length / me.maxAnnoLength);
    if(width < 1) width = 1;
    html2 += '<div class="icn3d-seqTitle" style="display:inline-block; color:white; font-weight:bold; background-color:' + color + '; width:' + width + 'px;">&nbsp;</div>';
    //htmlTmp = '<span class="icn3d-residueNum" title="ending protein sequence number">' + residArray.length + '</span>';
    //htmlTmp += '</span>';
    htmlTmp = '</span>';
    htmlTmp += '<br>';
    htmlTmp += '</div>';
    html += htmlTmp;
    html2 += htmlTmp;
    $("#" + me.pre + 'dt_giseq_' + name).html(html);
    $("#" + me.pre + 'ov_giseq_' + name).html(html2);
};
iCn3DUI.prototype.insertGap = function(chnid, seqIndex, text, bNohtml) {  var me = this, ic = me.icn3d; "use strict";
  var html = '';
  //if(me.cfg.blast_rep_id == chnid && me.targetGapHash!== undefined && me.targetGapHash.hasOwnProperty(seqIndex)) {
  if(me.targetGapHash!== undefined && me.targetGapHash.hasOwnProperty(seqIndex)) {
      for(var j = 0; j < (me.targetGapHash[seqIndex].to - me.targetGapHash[seqIndex].from + 1); ++j) {
          if(bNohtml) {
             html += text;
          }
          else {
             html += '<span>' + text + '</span>';
          }
      }
  }
  return html;
};
iCn3DUI.prototype.insertGapOverview = function(chnid, seqIndex) {  var me = this, ic = me.icn3d; "use strict";
  var html2 = '';
  if(me.cfg.blast_rep_id == chnid && me.targetGapHash!== undefined && me.targetGapHash.hasOwnProperty(seqIndex)) {
      var width = me.seqAnnWidth * (me.targetGapHash[seqIndex].to - me.targetGapHash[seqIndex].from + 1) / (me.maxAnnoLength + me.nTotalGap);
      html2 += '<div style="display:inline-block; background-color:#333; width:' + width + 'px; height:3px;">&nbsp;</div>';
  }
  return html2;
};
iCn3DUI.prototype.showSeq = function(chnid, chnidBase, type, queryTitle, compTitle, queryText, compText) {  var me = this, ic = me.icn3d; "use strict";
    var bNonMmdb = false;
    var giSeq;
    if(me.cfg.mmdbid === undefined && me.cfg.gi === undefined && me.cfg.blast_rep_id === undefined && me.cfg.align === undefined && me.cfg.chainalign === undefined) {
        bNonMmdb = true;
        giSeq = [];
        for(var i = 0; i < me.giSeq[chnid].length; ++i) {
            giSeq.push(ic.chainsSeq[chnid][i]);
        }
    }
    else {
        giSeq = me.giSeq[chnid];
    }

    // remove null giSeq[i]
    var giSeqTmp = [];
    for(var i = 0, il = giSeq.length; i < il; ++i) {
        if(giSeq[i]) {
            giSeqTmp.push(giSeq[i]);
        }
    }
    giSeq = giSeqTmp;
    var divLength = me.RESIDUE_WIDTH * me.giSeq[chnid].length + 200;
    var seqLength = me.giSeq[chnid].length
    if(seqLength > me.maxAnnoLength) {
        me.maxAnnoLength = seqLength;
    }
    var itemArray = ['giseq', 'cddsite', 'clinvar', 'snp', 'domain', 'interaction', 'custom', 'ssbond', 'crosslink', 'transmem'];
    for(var i in itemArray) {
        var item = itemArray[i];
        if($("#" + me.pre + item + "_" + chnid).length) $("#" + me.pre + item + "_" + chnid).width(divLength);
    }
    // gi html
    var html = '', html2 = '', html3 = '', htmlTmp;
    html += '<div class="icn3d-dl_sequence">';
    html3 += '<div class="icn3d-dl_sequence">';
    // html to display protein positions (10, 20, etc)
    //if(Object.keys(ic.chains[chnid]).length > 10) {
    if(me.giSeq[chnid].length > 10) {
        htmlTmp = '<div class="icn3d-residueLine" style="white-space:nowrap;">';
        var atom = ic.getFirstCalphaAtomObj(ic.chains[chnid]);
        //if(me.baseResi[chnid] != 0 && (me.cfg.mmdbid !== undefined || me.cfg.gi !== undefined || me.cfg.align !== undefined)) {
        if((me.cfg.mmdbid !== undefined || me.cfg.gi !== undefined || me.cfg.blast_rep_id !== undefined || me.cfg.align !== undefined || me.cfg.chainalign !== undefined) && atom.resi_ori !== undefined && atom.resi_ori != atom.resi && chnid.indexOf('Misc') == -1 ) {
            htmlTmp += '<div class="icn3d-annoTitle" anno="0" title="NCBI Residue Numbers">NCBI Residue Numbers</div>';
        }
        else {
            htmlTmp += '<div class="icn3d-annoTitle" anno="0"></div>';
        }
        htmlTmp += '<span class="icn3d-residueNum"></span>';
        html3 += htmlTmp + '<br>';
        html += htmlTmp + '<span class="icn3d-seqLine">';
        var helixCnt = 0, sheetCnt = 0;
        var savedSsName = '';
        for(var i = 0, il = giSeq.length; i < il; ++i) {
          html += me.insertGap(chnid, i, '-');
          var currResi;
          if(bNonMmdb) {
            currResi = giSeq[i].resi;
          }
          else {
            currResi = (i >= me.matchedPos[chnid] && i - me.matchedPos[chnid] < ic.chainsSeq[chnid].length) ? ic.chainsSeq[chnid][i - me.matchedPos[chnid]].resi : me.baseResi[chnid] + 1 + i;
          }
          html += '<span>'
          if( currResi % 10 === 0) {
            //html += currResi + ' ';
            html += currResi;
          }

          // name of secondary structures
          var residueid = chnid + '_' + currResi;
          // do not overlap residue number with ss label
          var bshowSsName = (currResi % 10 != 0 && currResi % 10 != 1 && currResi % 10 != 9) ? true : false;
          if( ic.residues.hasOwnProperty(residueid) ) {
            var atom = ic.getFirstCalphaAtomObj(ic.residues[residueid]);
            if(ic.secondaries[residueid] == 'H' && atom.ssbegin) {
                ++helixCnt;

                savedSsName = '<span class="icn3d-helix-color">H' + helixCnt + '</span>';

                if(bshowSsName) {
                    html += savedSsName;
                    savedSsName = '';
                }
            }
            else if(ic.secondaries[residueid] == 'E' && atom.ssbegin) {
                ++sheetCnt;
                if(ic.sheetcolor == 'green') {
                    savedSsName = '<span class="icn3d-sheet-color">S' + sheetCnt + '</span>';
                }
                else if(ic.sheetcolor == 'yellow') {
                    savedSsName = '<span class="icn3d-sheet-colory">S' + sheetCnt + '</span>';
                }

                if(bshowSsName) {
                    html += savedSsName;
                    savedSsName = '';
                }
            }
            else if(atom.ssend) {
                savedSsName = '';
            }

            if(savedSsName != '' && bshowSsName) {
                html += savedSsName;
                savedSsName = '';
            }
          }
          html += '</span>'
        }
        html += '<span class="icn3d-residueNum"></span>';
        html += '</span>';
        html += '<br>';
        html += '</div>';
        html3 += '</div>';
    }
    // html to display secondary structures
    htmlTmp = '<div class="icn3d-residueLine" style="white-space:nowrap;">';
    htmlTmp += '<div class="icn3d-annoTitle" anno="0"></div>';
    htmlTmp += '<span class="icn3d-residueNum"></span>';
    html3 += htmlTmp + '<br>';
    html += htmlTmp + '<span class="icn3d-seqLine">';
    for(var i = 0, il = giSeq.length; i < il; ++i) {
      html += me.insertGap(chnid, i, '-');
//      var resi = (me.baseResi[chnid] + i+1).toString();
//      var resi = ic.chainsSeq[chnid][i - me.matchedPos[chnid] ].resi;
      var resi = (i >= me.matchedPos[chnid] && i - me.matchedPos[chnid] < ic.chainsSeq[chnid].length) ? ic.chainsSeq[chnid][i - me.matchedPos[chnid]].resi : me.baseResi[chnid] + 1 + i;
      var residueid = chnid + '_' + resi;
      if( ic.residues.hasOwnProperty(residueid) ) {
        if(ic.secondaries[residueid] == 'H') {
            if(i % 2 == 0) {
                html += '<span class="icn3d-helix">';
            }
            else {
                html += '<span class="icn3d-helix2">';
            }
            html += '&nbsp;</span>';
        }
        else if(ic.secondaries[residueid] == 'E') {
            var atom = ic.getFirstCalphaAtomObj(ic.residues[residueid]);
            if(atom.ssend) {
                if(ic.sheetcolor == 'green') {
                    html += '<span class="icn3d-sheet2">';
                }
                else if(ic.sheetcolor == 'yellow') {
                    html += '<span class="icn3d-sheet2y">';
                }
            }
            else {
                if(ic.sheetcolor == 'green') {
                    html += '<span class="icn3d-sheet">';
                }
                else if(ic.sheetcolor == 'yellow') {
                    html += '<span class="icn3d-sheety">';
                }
            }
            html += '&nbsp;</span>';
        }
        else if(ic.secondaries[residueid] == 'c') {
            html += '<span class="icn3d-coil">&nbsp;</span>';
        }
        else if(ic.secondaries[residueid] == 'o') {
            html += '<span class="icn3d-other">&nbsp;</span>';
        }
      }
      else {
        html += '<span>-</span>'; //'<span>-</span>';
      }
    }
    html += '<span class="icn3d-residueNum"></span>';
    html += '</span>';
    html += '<br>';
    html += '</div>';
    html += '</div>'; // corresponds to above: html += '<div class="icn3d-dl_sequence">';
    html3 += '</div></div>';
    if(me.cfg.blast_rep_id === chnid) {
        htmlTmp = '<div id="' + me.pre + 'giseq_sequence" class="icn3d-dl_sequence" style="border: solid 1px #000;">';
    }
    else {
        htmlTmp = '<div id="' + me.pre + 'giseq_sequence" class="icn3d-dl_sequence">';
    }
    var chainType = 'Protein', chainTypeFull = 'Protein';
    if(type !== undefined) {
        if(type == 'nucleotide') {
            chainType = 'Nucl.';
            chainTypeFull = 'Nucleotide';
        }
        else if(type == 'chemical') {
            chainType = 'Chem.';
            chainTypeFull = 'Chemical';
        }
    }
    // sequence, detailed view
    htmlTmp += '<div class="icn3d-seqTitle icn3d-link icn3d-blue" gi="' + chnid + '" anno="sequence" chain="' + chnid + '"><span style="white-space:nowrap;" title="' + chainTypeFull + ' ' + chnid + '">' + chainType + ' ' + chnid + '</span></div>';
    htmlTmp += '<span class="icn3d-residueNum" title="starting protein sequence number">' + (me.baseResi[chnid]+1).toString() + '</span>';
    html3 += htmlTmp + '<br>';
    var htmlTmp2 = '<span class="icn3d-seqLine">';
    html += htmlTmp + htmlTmp2;
    html2 += htmlTmp + htmlTmp2;
    var pos, nGap = 0;

    for(var i = 0, il = giSeq.length; i < il; ++i) {
      html += me.insertGap(chnid, i, '-');
      if(me.targetGapHash !== undefined && me.targetGapHash.hasOwnProperty(i)) nGap += me.targetGapHash[i].to - me.targetGapHash[i].from + 1;
      var cFull = (bNonMmdb) ? giSeq[i].name : giSeq[i];
      var c = cFull;
      if(cFull.length > 1) {
          c = cFull[0] + '..';
      }
//      pos = (me.baseResi[chnid] + i+1).toString();
//      pos = ic.chainsSeq[chnid][i - me.matchedPos[chnid] ].resi;
      pos = (i >= me.matchedPos[chnid] && i - me.matchedPos[chnid] < ic.chainsSeq[chnid].length) ? ic.chainsSeq[chnid][i - me.matchedPos[chnid]].resi : me.baseResi[chnid] + 1 + i;
      if( !ic.residues.hasOwnProperty(chnid + '_' + pos) ) {
          c = c.toLowerCase();
          html += '<span title="' + cFull + pos + '" class="icn3d-residue">' + c + '</span>';
      }
      else {
          var color = '333333';
          if(me.cfg.blast_rep_id == chnid && me.fullpos2ConsTargetpos !== undefined && me.fullpos2ConsTargetpos[i + nGap] !== undefined) {
              color = me.fullpos2ConsTargetpos[i + nGap].color;
          }
          else {
              var atom = ic.getFirstCalphaAtomObj(ic.residues[chnid + '_' + pos]);
              var colorStr = (atom.color === undefined || atom.color.getHexString() === 'FFFFFF') ? 'DDDDDD' : atom.color.getHexString();
              color = (atom.color !== undefined) ? colorStr : "CCCCCC";
          }
          html += '<span id="giseq_' + me.pre + chnid + '_' + pos + '" title="' + cFull + pos + '" class="icn3d-residue" style="color:#' + color + '">' + c + '</span>';
      }
    }
    if(me.cfg.blast_rep_id == chnid) {
      // change color in 3D
      me.opts['color'] = 'conservation';
      ic.setColorByOptions(me.opts, ic.atoms);
      // remove highlight
      //me.removeHlSeq();
    }
    // sequence, overview
    var atom = ic.getFirstCalphaAtomObj(ic.chains[chnid]);
    var color = (atom.color) ? atom.color.getHexString() : "CCCCCC";
    var width = Math.round(me.seqAnnWidth * giSeq.length / me.maxAnnoLength);
    if(width < 1) width = 1;
    if(me.cfg.blast_rep_id != chnid) { // regular
        html2 += '<div id="giseq_summary_' + me.pre + chnid + '" class="icn3d-seqTitle icn3d-link" gi chain="' + chnid + '" style="display:inline-block; color:white; font-weight:bold; background-color:#' + color + '; width:' + width + 'px;">' + chnid + '</div>';
    }
    else { // with potential gaps
        var fromArray2 = [], toArray2 = [];
        fromArray2.push(0);
        for(var i = 0, il = giSeq.length; i < il; ++i) {
            if(me.targetGapHash !== undefined && me.targetGapHash.hasOwnProperty(i)) {
                toArray2.push(i - 1);
                fromArray2.push(i);
            }
        }
        toArray2.push(giSeq.length - 1);
        html2 += '<div id="giseq_summary_' + me.pre + chnid + '" class="icn3d-seqTitle icn3d-link" gi chain="' + chnid + '" style="width:' + width + 'px;">';
        for(var i = 0, il = fromArray2.length; i < il; ++i) {
            html2 += me.insertGapOverview(chnid, fromArray2[i]);
            html2 += '<div style="display:inline-block; color:white!important; font-weight:bold; background-color:#' + color + '; width:' + Math.round(me.seqAnnWidth * (toArray2[i] - fromArray2[i] + 1) / (me.maxAnnoLength + me.nTotalGap)) + 'px;" class="icn3d-seqTitle icn3d-link icn3d-blue" anno="sequence" gi chain="' + chnid + '" title="' + chnid + '">' + chnid + '</div>';
        }
        html2 += '</div>';
    }
    htmlTmp = '<span class="icn3d-residueNum" title="ending protein sequence number">' + pos + '</span>';
    htmlTmp += '</span>';
    htmlTmp += '<br>';
    html += htmlTmp;
    html2 += htmlTmp;
    if(me.cfg.blast_rep_id == chnid) {
        // 1. residue conservation
        if(compText !== undefined && compText !== '') {
        // conservation, detailed view
        htmlTmp = '<div class="icn3d-seqTitle icn3d-link icn3d-blue" blast="" posarray="' + me.consrvResPosArray.toString() + '" title="' + compTitle + '" setname="' + chnid + '_blast" anno="sequence" chain="' + chnid + '"><span style="white-space:nowrap;" title="' + compTitle + '">' + compTitle + '</span></div>';
        htmlTmp += '<span class="icn3d-residueNum"></span>';
        html3 += htmlTmp + '<br>';
        var htmlTmp2 = '<span class="icn3d-seqLine">';
        html += htmlTmp + htmlTmp2;
        html2 += htmlTmp + htmlTmp2;
        var prevEmptyWidth = 0;
        var prevLineWidth = 0;
        var widthPerRes = 1;
        var queryPos = me.queryStart;
        for(var i = 0, il = compText.length; i < il; ++i) {
          var c = compText[i];
          if(c == '-') {
              html += '<span>-</span>';
          }
          else if(c == ' ') {
              html += '<span> </span>';
          }
          else {
              var pos = me.fullpos2ConsTargetpos[i].pos;
              if( !ic.residues.hasOwnProperty(chnid + '_' + pos) ) {
                  c = c.toLowerCase();
                  html += '<span class="icn3d-residue">' + c + '</span>';
              }
              else {
                  var color = me.fullpos2ConsTargetpos[i].color;
                  html += '<span id="giseq_' + me.pre + chnid + '_' + pos + '" title="' + me.fullpos2ConsTargetpos[i].res + pos + '" class="icn3d-residue" style="color:#' + color + '">' + c + '</span>';
              }
              html2 += me.insertGapOverview(chnid, i);
              var emptyWidth = Math.round(me.seqAnnWidth * i / (me.maxAnnoLength + me.nTotalGap) - prevEmptyWidth - prevLineWidth);
              //if(emptyWidth < 0) emptyWidth = 0;
              if(emptyWidth >= 0) {
              html2 += '<div style="display:inline-block; width:' + emptyWidth + 'px;">&nbsp;</div>';
              html2 += '<div style="display:inline-block; background-color:#F00; width:' + widthPerRes + 'px;" title="' + c + pos + '">&nbsp;</div>';
              prevEmptyWidth += emptyWidth;
              prevLineWidth += widthPerRes;
              }
              ++queryPos;
          }
        }
        htmlTmp = '<span class="icn3d-residueNum"></span>';
        htmlTmp += '</span>';
        htmlTmp += '<br>';
        html += htmlTmp;
        html2 += htmlTmp;
        }
        // 2. Query text
        // query protein, detailed view
        htmlTmp = '<div class="icn3d-annoTitle" anno="sequence" chain="' + chnid + '"><span style="white-space:nowrap;" title="' + queryTitle + '">' + queryTitle + '</span></div>';
        htmlTmp += '<span class="icn3d-residueNum" title="starting protein sequence number">' + me.queryStart + '</span>';
        html3 += htmlTmp + '<br>';
        //var htmlTmp2 = '<span class="icn3d-seqLine">';
        var htmlTmp2 = '<span class="icn3d-seqLine" style="font-weight: bold;">';
        html += htmlTmp + htmlTmp2;
        html2 += htmlTmp + htmlTmp2;
        var queryPos = me.queryStart;
        for(var i = 0, il = queryText.length; i < il; ++i) {
          var c = queryText[i];
          if(c == ' ' || c == '-') {
              html += '<span>-</span>';
          }
          else {
              if( me.fullpos2ConsTargetpos !== undefined && me.fullpos2ConsTargetpos[i] !== undefined && !ic.residues.hasOwnProperty(chnid + '_' + me.fullpos2ConsTargetpos[i].pos) ) {
                  c = c.toLowerCase();
                  html += '<span title="' + c + queryPos + '" class="icn3d-residue">' + c + '</span>';
              }
              else {
                  html += '<span title="' + c + queryPos + '" class="icn3d-residue">' + c + '</span>';
              }
              ++queryPos;
          }
        }
        // query protein, overview
        var atom = ic.getFirstCalphaAtomObj(ic.chains[chnid]);
        var colorStr = (atom.color === undefined || atom.color.getHexString() === 'FFFFFF') ? 'DDDDDD' : atom.color.getHexString();
        var color = (atom.color !== undefined) ? colorStr : "CCCCCC";
        var fromArray2 = [], toArray2 = [];
        var prevChar = '-';
        for(var i = 0, il = queryText.length; i < il; ++i) {
            var c = queryText[i];
            if(c != '-' && prevChar == '-') {
                fromArray2.push(i);
            }
            else if(c == '-' && prevChar != '-' ) {
                toArray2.push(i-1);
            }
            prevChar = c;
        }
        if(prevChar != '-') {
            toArray2.push(queryText.length - 1);
        }
        for(var i = 0, il = fromArray2.length; i < il; ++i) {
            var emptyWidth = (i == 0) ? Math.round(me.seqAnnWidth * (fromArray2[i] - me.baseResi[chnid] - 1) / (me.maxAnnoLength + me.nTotalGap)) : Math.round(me.seqAnnWidth * (fromArray2[i] - toArray2[i-1] - 1) / (me.maxAnnoLength + me.nTotalGap));
            html2 += '<div style="display:inline-block; width:' + emptyWidth + 'px;">&nbsp;</div>';
            html2 += '<div style="display:inline-block; color:white!important; font-weight:bold; background-color:#' + color + '; width:' + Math.round(me.seqAnnWidth * (toArray2[i] - fromArray2[i] + 1) / (me.maxAnnoLength + me.nTotalGap)) + 'px;" anno="sequence" chain="' + chnid + '" title="' + queryTitle + '">' + queryTitle + '</div>';
        }
        htmlTmp = '<span class="icn3d-residueNum" title="ending protein sequence number">' + me.queryEnd + '</span>';
        htmlTmp += '</span>';
        htmlTmp += '<br>';
        html += htmlTmp;
        html2 += htmlTmp;
    }
    html += '</div>';
    html2 += '</div>';
    html3 += '</div>';
    //if(Object.keys(ic.chains[chnid]).length > 10) {
    if(me.giSeq[chnid].length > 10) {
        var atom = ic.getFirstCalphaAtomObj(ic.chains[chnid]);
        //if(me.baseResi[chnid] != 0 && (me.cfg.mmdbid !== undefined || me.cfg.gi !== undefined || me.cfg.align !== undefined)) {
        if((me.cfg.mmdbid !== undefined || me.cfg.gi !== undefined || me.cfg.blast_rep_id !== undefined || me.cfg.align !== undefined || me.cfg.chainalign !== undefined) && atom.resi_ori !== undefined && atom.resi_ori != atom.resi && chnid.indexOf('Misc') == -1 ) {
            htmlTmp = '<div class="icn3d-dl_sequence">';
            htmlTmp += '<div class="icn3d-residueLine" style="white-space:nowrap;">';
            htmlTmp += '<div class="icn3d-annoTitle" anno="0" title="PDB Residue Numbers">PDB Residue Numbers</div>';
            htmlTmp += '<span class="icn3d-residueNum"></span>';
            html3 += htmlTmp + '<br>';
            html += htmlTmp + '<span class="icn3d-seqLine">';
            for(var i = 0, il = giSeq.length; i < il; ++i) {
                html += me.insertGap(chnid, i, '-');
                if(i >= me.matchedPos[chnid] && i - me.matchedPos[chnid] < ic.chainsSeq[chnid].length) {
                  var currResi = ic.chainsSeq[chnid][i - me.matchedPos[chnid]].resi;
                  var residueid = chnid + '_' + currResi;
                  if(!ic.residues.hasOwnProperty(residueid)) {
                      html += '<span></span>';
                  }
                  else {
                      var atom = ic.getFirstCalphaAtomObj(ic.residues[residueid]);
                      var resi_ori = atom.resi_ori;
                      html += '<span>';
                      if( resi_ori % 10 === 0) {
                        html += resi_ori + ' ';
                      }
                      html += '</span>';
                  }
                }
                else {
                  html += '<span></span>';
                }
            }
            html += '<span class="icn3d-residueNum"></span>';
            html += '</span>';
            html += '<br>';
            html += '</div>';
            html += '</div>';
            html3 += '</div></div>';
        }
    }
    $("#" + me.pre + 'dt_giseq_' + chnid).html(html);
    $("#" + me.pre + 'ov_giseq_' + chnid).html(html2);
    $("#" + me.pre + 'tt_giseq_' + chnid).html(html3); // fixed title for scrolling
};
iCn3DUI.prototype.navClinVar = function(chnid) { var me = this, ic = me.icn3d; "use strict";
    me.currClin[chnid] = - 1;
    $(document).on('click', "#" + me.pre + chnid + "_prevclin", function(e) { var ic = me.icn3d;
      e.stopImmediatePropagation();
      //e.preventDefault();
      var maxLen = (me.resi2disease_nonempty[chnid] !== undefined) ? Object.keys(me.resi2disease_nonempty[chnid]).length : 0;
      --me.currClin[chnid];
      if(me.currClin[chnid] < 0) me.currClin[chnid] = maxLen - 1; // 0;
      me.showClinVarLabelOn3D(chnid);
    });
    $(document).on('click', "#" + me.pre + chnid + "_nextclin", function(e) { var ic = me.icn3d;
      e.stopImmediatePropagation();
      //e.preventDefault();
      var maxLen = (me.resi2disease_nonempty[chnid] !== undefined) ? Object.keys(me.resi2disease_nonempty[chnid]).length : 0;
      ++me.currClin[chnid];
      if(me.currClin[chnid] > maxLen - 1) me.currClin[chnid] = 0; // me.resi2disease_nonempty[chnid].length - 1;
      me.showClinVarLabelOn3D(chnid);
    });
};
iCn3DUI.prototype.showClinVarLabelOn3D = function(chnid) { var me = this, ic = me.icn3d; "use strict";
      var resiArray = Object.keys(me.resi2disease_nonempty[chnid]);
      var chainid, residueid;
      chainid = chnid;
      residueid = chainid + '_' + resiArray[me.currClin[chnid]];
      var label = '';
      var diseaseArray = me.resi2disease_nonempty[chnid][resiArray[me.currClin[chnid]]];
      for(var k = 0, kl = diseaseArray.length; k < kl; ++k) {
          if(diseaseArray[k] != '' && diseaseArray[k] != 'not specified' && diseaseArray[k] != 'not provided') {
            label = diseaseArray[k];
            break;
          }
      }
      var position = ic.centerAtoms(ic.hash2Atoms(ic.residues[residueid]));
      //position.center.add(new THREE.Vector3(3.0, 3.0, 3.0)); // shift a little bit
      var maxlen = 30;
      if(label.length > maxlen) label = label.substr(0, maxlen) + '...';
      me.removeSelection();
      if(ic.labels == undefined) ic.labels = {};
      ic.labels['clinvar'] = [];
      //var size = Math.round(ic.LABELSIZE * 10 / label.length);
      var size = ic.LABELSIZE;
      var color = "#FFFF00";
      me.addLabel(label, position.center.x + 1, position.center.y + 1, position.center.z + 1, size, color, undefined, 'clinvar');
      ic.hAtoms = {};
      for(var j in ic.residues[residueid]) {
          ic.hAtoms[j] = 1;
      }
      //ic.addResiudeLabels(ic.hAtoms);
      $("#clinvar_" + me.pre + residueid).addClass('icn3d-highlightSeq');
      if($("#" + me.pre + "modeswitch")[0] !== undefined && !$("#" + me.pre + "modeswitch")[0].checked) {
          me.setMode('selection');
      }
      ic.draw();
};
iCn3DUI.prototype.getSnpLine = function(line, totalLineNum, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, bStartEndRes, chnid, bOverview, bClinvar, bTitleOnly, bSnpOnly) { var me = this, ic = me.icn3d; "use strict";
    var html = '';
    var altName = bClinvar ? 'clinvar' : 'snp';
    // determine whether the SNPis from virus directly
    var bVirus = false;
    for(var resi in resi2rsnum) {
        for(var i = 0, il = resi2rsnum[resi].length; i < il; ++i) {
            if(resi2rsnum[resi][i] == 0) {
                bVirus = true;
                break;
            }
        }
        if(bVirus) break;
    }
    if(bStartEndRes) {
        var title1 = 'ClinVar', title2 = 'SNP', title2b = 'SNP', warning = "", warning2 = "";
        if(!bVirus && ic.organism !== undefined && ic.organism !== 'human' && ic.organism !== 'homo sapiens') {
            warning = " <span style='color:#FFA500'>(from human)</span>";
            warning2 = " <span style='color:#FFA500'>(based on human sequences and mapped to this structure by sequence similarity)</span>";
        }
        if(bClinvar) {
            html += '<div class="icn3d-seqTitle icn3d-link icn3d-blue icn3d-clinvar-path" clinvar="clinvar" posarray="' + posClinArray + '" shorttitle="' + title1 + '" setname="' + chnid + '_' + title1 + '" anno="sequence" chain="' + chnid + '" title="' + title1 + warning2 + '">' + title1 + warning + '</div>';
        }
        else {
            html += '<div class="icn3d-seqTitle icn3d-link icn3d-blue" clinvar="clinvar" posarray="' + posarray + '" shorttitle="' + title2 + '" setname="' + chnid + '_' + title2 + '" anno="sequence" chain="' + chnid + '" title="' + title2 + warning2 + '">' + title2 + warning + '</div>';
        }
    }
    else if(line == 2 && bClinvar) {
        var buttonStyle = me.isMobile() ? 'none' : 'button';
        html += '<div id="' + me.pre + chnid + '_prevclin" style="display:inline-block; font-size:11px; font-weight:bold; width:60px!important;"><button class="link" style="-webkit-appearance:' + buttonStyle + '; height:18px; width:55px;"><span style="white-space:nowrap; margin-left:-40px;" title="Show the previous ClinVar on structure">&lt; ClinVar</span></button></div>';
        html += '<div id="' + me.pre + chnid + '_nextclin" style="display:inline-block; font-size:11px; font-weight:bold; width:60px!important;"><button class="link" style="-webkit-appearance:' + buttonStyle + '; height:18px; width:55px;"><span style="white-space:nowrap; margin-left:-40px;" title="Show the next ClinVar on structure">ClinVar &gt;</span></button></div>';
    }
    else {
        html += '<div class="icn3d-seqTitle"></div>';
    }
    var pre = altName;
    var snpCnt = 0, clinvarCnt = 0;
    var snpTypeHash = {}, currSnpTypeHash = {};
    for(var i = 1, il = me.giSeq[chnid].length; i <= il; ++i) {
        if(resi2index[i] !== undefined) {
            ++snpCnt;
            var snpType = '', allDiseaseTitle = '';
            for(var j = 0, jl = resi2snp[i].length; j < jl && !bSnpOnly; ++j) {
                var diseaseArray = resi2disease[i][j].split('; ');
                var sigArray = resi2sig[i][j].split('; ');
                var diseaseTitle = '';
                for(var k = 0, kl = diseaseArray.length; k < kl; ++k) {
                    if(diseaseArray[k] != '' && diseaseArray[k] != 'not specified' && diseaseArray[k] != 'not provided') {
                        diseaseTitle += diseaseArray[k] + ' (' + sigArray[k] + '); ';
                    }
                }
                if(diseaseTitle != '') {
                    snpTypeHash[i] = 'icn3d-clinvar';
                    if(j == line - 2) { // just check the current line, "line = 2" means the first SNP
                        currSnpTypeHash[i] = 'icn3d-clinvar';
                        if(diseaseTitle.indexOf('Pathogenic') != -1) {
                            currSnpTypeHash[i] = 'icn3d-clinvar-path';
                        }
                    }
                }
                allDiseaseTitle += diseaseTitle + ' | ';
            }
            if(allDiseaseTitle.indexOf('Pathogenic') != -1) {
                snpTypeHash[i] = 'icn3d-clinvar-path';
            }
            if(snpTypeHash[i] == 'icn3d-clinvar' || snpTypeHash[i] == 'icn3d-clinvar-path') {
                ++clinvarCnt;
            }
        }
    }
    if(snpCnt == 0 && !bClinvar) {
        $("#" + me.pre + 'dt_clinvar_' + chnid).html('');
        $("#" + me.pre + 'ov_clinvar_' + chnid).html('');
        $("#" + me.pre + 'tt_clinvar_' + chnid).html('');
        $("#" + me.pre + 'dt_snp_' + chnid).html('');
        $("#" + me.pre + 'ov_snp_' + chnid).html('');
        $("#" + me.pre + 'tt_snp_' + chnid).html('');
        return '';
    }
    if(clinvarCnt == 0 && bClinvar) {
        $("#" + me.pre + 'dt_clinvar_' + chnid).html('');
        $("#" + me.pre + 'ov_clinvar_' + chnid).html('');
        $("#" + me.pre + 'tt_clinvar_' + chnid).html('');
        return '';
    }
    var cnt = bClinvar ? clinvarCnt : snpCnt;
    if(line == 1) {
        html += '<span class="icn3d-residueNum" title="residue count">' + cnt + ' Res</span>';
    }
    else {
        html += '<span class="icn3d-residueNum"></span>';
    }
    if(bTitleOnly) {
        return html + '<br>';
    }
    html += '<span class="icn3d-seqLine">';
    var diseaseStr = '';
    var prevEmptyWidth = 0;
    var prevLineWidth = 0;
    var widthPerRes = 1;
    for(var i = 1, il = me.giSeq[chnid].length; i <= il; ++i) {
        if(bOverview) {
            if(resi2index[i] !== undefined) {
                // get the mouse over text
                var cFull = me.giSeq[chnid][i-1];
                var c = cFull;
                if(cFull.length > 1) {
                    c = cFull[0] + '..';
                }
                var pos = (i >= me.matchedPos[chnid] && i-1 - me.matchedPos[chnid] < ic.chainsSeq[chnid].length) ? ic.chainsSeq[chnid][i-1 - me.matchedPos[chnid]].resi : me.baseResi[chnid] + 1 + i-1;
                var snpTitle = pos + c + '>';
                var allDiseaseTitle = '';
                for(var j = 0, jl = resi2snp[i].length; j < jl; ++j) {
                    snpTitle += resi2snp[i][j];
                    if(!bSnpOnly) {
                        var diseaseArray = resi2disease[i][j].split('; ');
                        var sigArray = resi2sig[i][j].split('; ');
                        var diseaseTitle = '';
                        for(var k = 0, kl = diseaseArray.length; k < kl; ++k) {
                            if(diseaseArray[k] != '' && diseaseArray[k] != 'not specified' && diseaseArray[k] != 'not provided') {
                                diseaseTitle += diseaseArray[k] + ' (' + sigArray[k] + '); ';
                            }
                        }
                        allDiseaseTitle += diseaseTitle + ' | ';
                    }
                }
                html += me.insertGapOverview(chnid, i-1);
                var emptyWidth = (me.cfg.blast_rep_id == chnid) ? Math.round(me.seqAnnWidth * (i-1) / (me.maxAnnoLength + me.nTotalGap) - prevEmptyWidth - prevLineWidth) : Math.round(me.seqAnnWidth * (i-1) / me.maxAnnoLength - prevEmptyWidth - prevLineWidth);
                //if(emptyWidth < 0) emptyWidth = 0;
                if(bClinvar) {
                    if(snpTypeHash[i] == 'icn3d-clinvar' || snpTypeHash[i] == 'icn3d-clinvar-path') {
                        if(emptyWidth >= 0) {
                            html += '<div style="display:inline-block; width:' + emptyWidth + 'px;">&nbsp;</div>';
                            html += '<div style="display:inline-block; background-color:#000; width:' + widthPerRes + 'px;" title="' + snpTitle + '">&nbsp;</div>';
                            prevEmptyWidth += emptyWidth;
                            prevLineWidth += widthPerRes;
                        }
                    }
                }
                else {
                    if(emptyWidth > 0) {
                        html += '<div style="display:inline-block; width:' + emptyWidth + 'px;">&nbsp;</div>';
                        html += '<div style="display:inline-block; background-color:#000; width:' + widthPerRes + 'px;" title="' + snpTitle + '">&nbsp;</div>';
                        prevEmptyWidth += emptyWidth;
                        prevLineWidth += widthPerRes;
                    }
                }
            }
        }
        else { // detailed view
          html += me.insertGap(chnid, i-1, '-');
          if(resi2index[i] !== undefined) {
              if(!bClinvar && line == 1) {
                  html += '<span>&dArr;</span>'; // or down triangle &#9660;
              }
              else {
                var cFull = me.giSeq[chnid][i-1];
                var c = cFull;
                if(cFull.length > 1) {
                  c = cFull[0] + '..';
                }
                var pos = (i >= me.matchedPos[chnid] && i-1 - me.matchedPos[chnid] < ic.chainsSeq[chnid].length) ? ic.chainsSeq[chnid][i-1 - me.matchedPos[chnid]].resi : me.baseResi[chnid] + 1 + i-1;
                var snpStr = "", snpTitle = "<div class='snptip'>"
                //var snpType = '';
                var jl = resi2snp[i].length;
                var start = 0, end = 0;
                var shownResCnt;
                if(line == 2) {
                    start = 0;
                    //end = 1;
                    end = jl;
                }
                //else if(line == 3) {
                //    start = 1;
                //    end = jl;
                //}
                if(!bClinvar) {
                    //shownResCnt = 2;
                    shownResCnt = 1;
                    for(var j = start; j < jl && j < end; ++j) {
                        var snpTmpStr = chnid + "_" + pos + "_" + resi2snp[i][j];
                        var buttonStyle = me.isMobile() ? 'none' : 'button';

                        var bCoord = true;
                        if( !ic.residues.hasOwnProperty(chnid + '_' + pos) ) {
                            bCoord = false;
                        }

                        if(j < shownResCnt) snpStr += resi2snp[i][j];
                        snpTitle += pos + c + '>' + resi2snp[i][j];

                        if(!bSnpOnly) {
                            // disease and significace
                            var diseaseArray = resi2disease[i][j].split('; ');
                            var sigArray = resi2sig[i][j].split('; ');
                            var diseaseTitle = '';
                            var index = 0;
                            for(var k = 0, kl = diseaseArray.length; k < kl; ++k) {
                                if(diseaseArray[k] != '' && diseaseArray[k] != 'not specified' && diseaseArray[k] != 'not provided') {
                                    if(index > 0) {
                                        diseaseTitle += '; ';
                                    }
                                    else {
                                        if( j === 0 || j === 1) diseaseStr = 'disease="' + diseaseArray[k] + '"';
                                    }
                                    diseaseTitle += diseaseArray[k] + ' (' + sigArray[k] + ')';
                                    ++index;
                                }
                            }

                            //resi2rsnum, resi2clinAllele,
                            if(diseaseTitle != '') {
                                //snpType = 'icn3d-clinvar';
                                snpTitle += ': ' + diseaseTitle;

                                if(bCoord) {
                                    snpTitle += '<br>' + me.addSnpButton(snpTmpStr, 'snpin3d', '3D with scap', 'SNP in 3D with scap', 70, buttonStyle) + '&nbsp;&nbsp;';
                                    snpTitle += me.addSnpButton(snpTmpStr, 'snpinter', 'Interactions', 'SNP Interactions in 3D', 70, buttonStyle) + '&nbsp;&nbsp;';
                                    snpTitle += me.addSnpButton(snpTmpStr, 'snppdb', 'PDB', 'Download SNP PDB', 35, buttonStyle);
                                }

                                //snpTitle += "<br>Links: <span class='" + me.pre + "snpin3d icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP in 3D with scap</span>, <span class='" + me.pre + "snpinter icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP Interactions in 3D</span>, <span class='" + me.pre + "snppdb icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP PDB</span>, <a href='https://www.ncbi.nlm.nih.gov/clinvar/?term=" + resi2clinAllele[i][j] + "[AlleleID]' target='_blank'>ClinVar</a>, <a href='https://www.ncbi.nlm.nih.gov/snp/?term=" + resi2rsnum[i][j] + "' target='_blank'>dbSNP (rs" + resi2rsnum[i][j] + ")</a>";
                                snpTitle += "<br>Links: <a href='https://www.ncbi.nlm.nih.gov/clinvar/?term=" + resi2clinAllele[i][j] + "[AlleleID]' target='_blank'>ClinVar</a>, <a href='https://www.ncbi.nlm.nih.gov/snp/?term=" + resi2rsnum[i][j] + "' target='_blank'>dbSNP (rs" + resi2rsnum[i][j] + ")</a>";
                            }
                            else {
                                if(bCoord) {
                                    snpTitle += '<br>' + me.addSnpButton(snpTmpStr, 'snpin3d', '3D with scap', 'SNP in 3D with scap', 70, buttonStyle) + '&nbsp;&nbsp;';
                                    snpTitle += me.addSnpButton(snpTmpStr, 'snpinter', 'Interactions', 'SNP Interactions in 3D', 70, buttonStyle) + '&nbsp;&nbsp;';
                                    snpTitle += me.addSnpButton(snpTmpStr, 'snppdb', 'PDB', 'Download SNP PDB', 35, buttonStyle);
                                }

                                //snpTitle += "<br>Links: <span class='" + me.pre + "snpin3d icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP in 3D with scap</span>, <span class='" + me.pre + "snpinter icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP Interactions in 3D</span>, <span class='" + me.pre + "snppdb icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP PDB</span>, <a href='https://www.ncbi.nlm.nih.gov/snp/?term=" + resi2rsnum[i][j] + "' target='_blank'>dbSNP (rs" + resi2rsnum[i][j] + ")</a>"
                                snpTitle += "<br>Link: <a href='https://www.ncbi.nlm.nih.gov/snp/?term=" + resi2rsnum[i][j] + "' target='_blank'>dbSNP (rs" + resi2rsnum[i][j] + ")</a>"
                            }
                            if(j < jl - 1) {
                                //if(j < 1) snpStr += ';';
                                snpTitle += '<br><br>';
                            }
                        }
                        else { //if(bSnpOnly) {
                            if(bCoord) {
                                snpTitle += '<br>' + me.addSnpButton(snpTmpStr, 'snpin3d', '3D with scap', 'SNP in 3D with scap', 70, buttonStyle) + '&nbsp;&nbsp;';
                                snpTitle += me.addSnpButton(snpTmpStr, 'snpinter', 'Interactions', 'SNP Interactions in 3D', 70, buttonStyle) + '&nbsp;&nbsp;';
                                snpTitle += me.addSnpButton(snpTmpStr, 'snppdb', 'PDB', 'Download SNP PDB', 35, buttonStyle);
                            }

                            if(resi2rsnum[i][j] != 0) {
                                //snpTitle += "<br>Links: <span class='" + me.pre + "snpin3d icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP in 3D with scap</span>, <span class='" + me.pre + "snpinter icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP Interactions in 3D</span>, <span class='" + me.pre + "snppdb icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP PDB</span>, <a href='https://www.ncbi.nlm.nih.gov/snp/?term=" + resi2rsnum[i][j] + "' target='_blank'>dbSNP (rs" + resi2rsnum[i][j] + ")</a>";
                                snpTitle += "<br>Link: <a href='https://www.ncbi.nlm.nih.gov/snp/?term=" + resi2rsnum[i][j] + "' target='_blank'>dbSNP (rs" + resi2rsnum[i][j] + ")</a>";
                            }
                            else {
                                //snpTitle += "<br>Links: <span class='" + me.pre + "snpin3d icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP in 3D with scap</span>, <span class='" + me.pre + "snpinter icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP Interactions in 3D</span>, <span class='" + me.pre + "snppdb icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP PDB</span>";
                            }

                            if(j < jl - 1) {
                                snpTitle += '<br><br>';
                            }
                        }
                    }
                    //if(jl > shownResCnt && line == 3) snpStr += '..';
                    if(jl > shownResCnt && line == 2) snpStr += '..';
                }
                else { // if(bClinvar)
                    shownResCnt = 1;
                    var diseaseCnt = 0;
                    for(var j = start; j < jl && j < end; ++j) {
                        var snpTmpStr = chnid + "_" + pos + "_" + resi2snp[i][j];
                        var buttonStyle = me.isMobile() ? 'none' : 'button';

                        var bCoord = true;
                        if( !ic.residues.hasOwnProperty(chnid + '_' + pos) ) {
                            bCoord = false;
                        }

                        // disease and significace
                        var diseaseArray = resi2disease[i][j].split('; ');
                        var sigArray = resi2sig[i][j].split('; ');
                        var diseaseTitle = '';
                        var index = 0;
                        for(var k = 0, kl = diseaseArray.length; k < kl; ++k) {
                            if(diseaseArray[k] != '' && diseaseArray[k] != 'not specified' && diseaseArray[k] != 'not provided') {
                                if(index > 0) {
                                    diseaseTitle += '; ';
                                }
                                else {
                                    if( j === 0 || j === 1) diseaseStr = 'disease="' + diseaseArray[k] + '"';
                                }
                                diseaseTitle += diseaseArray[k] + ' (' + sigArray[k] + ')';
                                ++index;
                            }
                        }
                        if(diseaseTitle != '') {
                            if(diseaseCnt < shownResCnt) snpStr += resi2snp[i][j];
                            snpTitle += pos + c + '>' + resi2snp[i][j];
                            //snpType = 'icn3d-clinvar';
                            snpTitle += ': ' + diseaseTitle;

                            if(bCoord) {
                                snpTitle += '<br>' + me.addSnpButton(snpTmpStr, 'snpin3d', '3D with scap', 'SNP in 3D with scap', 70, buttonStyle) + '&nbsp;&nbsp;';
                                snpTitle += me.addSnpButton(snpTmpStr, 'snpinter', 'Interactions', 'SNP Interactions in 3D', 70, buttonStyle) + '&nbsp;&nbsp;';
                                snpTitle += me.addSnpButton(snpTmpStr, 'snppdb', 'PDB', 'Download SNP PDB', 35, buttonStyle);
                            }

                            //snpTitle += "<br>Links: <span class='" + me.pre + "snpin3d icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP in 3D with scap</span>, <span class='" + me.pre + "snpinter icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP Interactions in 3D</span>, <span class='" + me.pre + "snppdb icn3d-snplink' snp='" + chnid + "_" + pos + "_" + resi2snp[i][j] + "'>SNP PDB</span>, <a href='https://www.ncbi.nlm.nih.gov/clinvar/?term=" + resi2clinAllele[i][j] + "[AlleleID]' target='_blank'>ClinVar</a>, <a href='https://www.ncbi.nlm.nih.gov/snp/?term=" + resi2rsnum[i][j] + "' target='_blank'>dbSNP (rs" + resi2rsnum[i][j] + ")</a>";
                            snpTitle += "<br>Links: <a href='https://www.ncbi.nlm.nih.gov/clinvar/?term=" + resi2clinAllele[i][j] + "[AlleleID]' target='_blank'>ClinVar</a>, <a href='https://www.ncbi.nlm.nih.gov/snp/?term=" + resi2rsnum[i][j] + "' target='_blank'>dbSNP (rs" + resi2rsnum[i][j] + ")</a>";
                            if(j < jl - 1) {
                                snpTitle += '<br><br>';
                            }
                            ++diseaseCnt;
                        } // if(diseaseTitle != '') {
                    } // for(var j = start; j < jl && j < end; ++j) {
                    //if(diseaseCnt > shownResCnt && line == 3) snpStr += '..';
                    if(diseaseCnt > shownResCnt && line == 2) snpStr += '..';
                } // else { // if(bClinvar)
                snpTitle += '</div>';
                if(bClinvar) {
                    if(snpTypeHash[i] == 'icn3d-clinvar' || snpTypeHash[i] == 'icn3d-clinvar-path') {
                        if(line == 1) {
                            html += '<span>&dArr;</span>'; // or down triangle &#9660;
                        }
                        else {
                            if(snpStr == '' || snpStr == ' ') {
                                html += '<span>-</span>';
                            }
                            else {
                                html += '<span id="' + pre + '_' + me.pre + chnid + '_' + pos + '" label title="' + snpTitle + '" ' + diseaseStr + ' class="icn3d-tooltip icn3d-residue ' + currSnpTypeHash[i] + '">' + snpStr + '</span>';
                            }
                        }
                    }
                    else {
                        html += '<span>-</span>';
                    }
                }
                else {
                    if(snpStr == '' || snpStr == ' ') {
                        html += '<span>-</span>';
                    }
                    else {
                        if(!bSnpOnly) {
                            html += '<span id="' + pre + '_' + me.pre + chnid + '_' + pos + '" label title="' + snpTitle + '" ' + diseaseStr + ' class="icn3d-tooltip icn3d-residue ' + currSnpTypeHash[i] + '">' + snpStr + '</span>';
                        }
                        else {
                            html += '<span id="' + pre + '_' + me.pre + chnid + '_' + pos + '" label title="' + snpTitle + '" class="icn3d-tooltip icn3d-residue ' + currSnpTypeHash[i] + '">' + snpStr + '</span>';
                        }
                    }
                }
              } // if(!bClinvar && line == 1) {
          }
          else {
            html += '<span>-</span>'; //'<span>-</span>';
          }
        } // if(bOverview) {
    } // for
    //var end = bStartEndRes ? ic.chainsSeq[chnid][me.giSeq[chnid].length - 1 - me.matchedPos[chnid] ].resi : '';
    if(line == 1) {
        html += '<span class="icn3d-residueNum" title="residue count">&nbsp;' + cnt + ' Residues</span>';
    }
    else {
        html += '<span class="icn3d-residueNum"></span>';
    }
    html += '</span>';
    html += '<br>';
    return html;
};
iCn3DUI.prototype.processSnpClinvar = function(data, chnid, chnidBase, bSnpOnly, bVirus) { var me = this, ic = me.icn3d; "use strict";
    var html = '<div id="' + me.pre + chnid + '_snpseq_sequence" class="icn3d-dl_sequence">';
    var html2 = html;
    var html3 = html;
    var htmlClinvar = '<div id="' + me.pre + chnid + '_clinvarseq_sequence" class="icn3d-dl_sequence">';
    var htmlClinvar2 = htmlClinvar;
    var htmlClinvar3 = htmlClinvar;
    var lineArray = (!bSnpOnly || bVirus) ? data.data : data.split('\n');
    var resi2snp = {};
    var resi2index = {};
    var resi2disease = {};
    if(me.resi2disease_nonempty[chnid] === undefined) me.resi2disease_nonempty[chnid] = {};
    var resi2sig = {};
    var resi2rsnum = {};
    var resi2clinAllele = {};
    var posHash = {}, posClinHash = {};
    var prevSnpStr = '';
    for(var i = 0, il = lineArray.length; i < il; ++i) {
     //bSnpOnly: false
     //1310770    13    14    14Y>H    368771578    150500    Hereditary cancer-predisposing syndrome; Li-Fraumeni syndrome; not specified; Li-Fraumeni syndrome 1    Likely benign; Uncertain significance; Uncertain significance; Uncertain significance    1TSR_A    120407068    NP_000537.3
     //Pdb_gi, Pos from, Pos to, Pos & Amino acid change, rs#, ClinVar Allele ID, Disease name, Clinical significance, master accession, master_gi, master_accession.version
     //bSnpOnly: true
     //1310770    13    14    14Y>H    1111111
     if(lineArray[i] != '') {
      var fieldArray = (!bSnpOnly || bVirus) ? lineArray[i] : lineArray[i].split('\t');
      var snpStr = fieldArray[3];
      if(snpStr == prevSnpStr) continue;
      prevSnpStr = snpStr;
      var resiStr = snpStr.substr(0, snpStr.length - 3);
      var resi = Math.round(resiStr);
      var currRes = snpStr.substr(snpStr.length - 3, 1);
      var snpRes = snpStr.substr(snpStr.length - 1, 1);
      //var rsnum = bSnpOnly ? '' : fieldArray[4];
      var rsnum = fieldArray[4];
      var clinAllele = bSnpOnly ? '' : fieldArray[5];
      var disease = bSnpOnly ? '' : fieldArray[6];  // When more than 2+ diseases, they are separated by "; "
                                    // Some are "not specified", "not provided"
      var clinSig = bSnpOnly ? '' : fieldArray[7];     // Clinical significance, When more than 2+ diseases, they are separated by "; "
      // "*" means terminating codon, "-" means deleted codon
      //if(currRes !== '-' && currRes !== '*' && snpRes !== '-' && snpRes !== '*') {
            posHash[resi + me.baseResi[chnid]] = 1;
            if(disease != '') posClinHash[resi + me.baseResi[chnid]] = 1;
            resi2index[resi] = i + 1;
            if(resi2snp[resi] === undefined) {
                resi2snp[resi] = [];
            }
            resi2snp[resi].push(snpRes);
            if(resi2rsnum[resi] === undefined) {
                resi2rsnum[resi] = [];
            }
            resi2rsnum[resi].push(rsnum);
            if(resi2clinAllele[resi] === undefined) {
                resi2clinAllele[resi] = [];
            }
            resi2clinAllele[resi].push(clinAllele);
            if(resi2disease[resi] === undefined) {
                resi2disease[resi] = [];
            }
            resi2disease[resi].push(disease);
            if(disease != '') {
                if(me.resi2disease_nonempty[chnid][resi] === undefined) {
                    me.resi2disease_nonempty[chnid][resi] = [];
                }
                me.resi2disease_nonempty[chnid][resi].push(disease);
            }
            if(resi2sig[resi] === undefined) {
                resi2sig[resi] = [];
            }
            resi2sig[resi].push(clinSig);
      //}
     }
    }
    var posarray = Object.keys(posHash);
    var posClinArray = Object.keys(posClinHash);
    if(bSnpOnly) {
        var bClinvar = false;
        html += me.getSnpLine(1, 2, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 1, chnid, false, bClinvar, undefined, bSnpOnly);
        html += me.getSnpLine(2, 2, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 0, chnid, false, bClinvar, undefined, bSnpOnly);
        //html += me.getSnpLine(3, 3, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 0, chnid, false, bClinvar, undefined, bSnpOnly);
        html3 += me.getSnpLine(1, 2, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 1, chnid, false, bClinvar, true, bSnpOnly);
        html3 += me.getSnpLine(2, 2, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 0, chnid, false, bClinvar, true, bSnpOnly);
        //html3 += me.getSnpLine(3, 3, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 0, chnid, false, bClinvar, true, bSnpOnly);
        html2 += me.getSnpLine(1, 2, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 1, chnid, true, bClinvar, undefined, bSnpOnly);
        html += '</div>';
        html2 += '</div>';
        html3 += '</div>';
        $("#" + me.pre + 'dt_snp_' + chnid).html(html);
        $("#" + me.pre + 'ov_snp_' + chnid).html(html2);
        $("#" + me.pre + 'tt_snp_' + chnid).html(html3);
    }
    else {
    //if(!bSnpOnly && me.bClinvarCnt) {
        bClinvar = true;
        htmlClinvar += me.getSnpLine(1, 2, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 1, chnid, false, bClinvar, undefined, bSnpOnly);
        htmlClinvar += me.getSnpLine(2, 2, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 0, chnid, false, bClinvar, undefined, bSnpOnly);
        //htmlClinvar += me.getSnpLine(3, 3, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 0, chnid, false, bClinvar, undefined, bSnpOnly);
        htmlClinvar3 += me.getSnpLine(1, 2, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 1, chnid, false, bClinvar, true, bSnpOnly);
        htmlClinvar3 += me.getSnpLine(2, 2, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 0, chnid, false, bClinvar, true, bSnpOnly);
        //htmlClinvar3 += me.getSnpLine(3, 3, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 0, chnid, false, bClinvar, true, bSnpOnly);
        htmlClinvar2 += me.getSnpLine(1, 2, resi2snp, resi2rsnum, resi2clinAllele, resi2disease, resi2index, resi2sig, posarray, posClinArray, 1, chnid, true, bClinvar, undefined, bSnpOnly);
        htmlClinvar += '</div>';
        htmlClinvar2 += '</div>';
        htmlClinvar3 += '</div>';
        $("#" + me.pre + 'dt_clinvar_' + chnid).html(htmlClinvar);
        $("#" + me.pre + 'ov_clinvar_' + chnid).html(htmlClinvar2);
        $("#" + me.pre + 'tt_clinvar_' + chnid).html(htmlClinvar3);
        me.navClinVar(chnid, chnidBase);
    }
    // add here after the ajax call
    me.enableHlSeq();
    if(bSnpOnly) {
        me.bAjaxSnp = true;
        if(me.deferredSnp !== undefined) me.deferredSnp.resolve();
    }
    else {
        me.bAjaxClinvar = true;
        if(me.deferredClinvar !== undefined) me.deferredClinvar.resolve();
    }
};
iCn3DUI.prototype.showClinvarPart2 = function(chnid, chnidBase, gi) { var me = this, ic = me.icn3d; "use strict";
    //var url = "https://www.ncbi.nlm.nih.gov/projects/SNP/beVarSearch_mt.cgi?appname=iCn3D&format=bed&report=pdb2bed&acc=" + chnidBase;
    //var url = "https://www.ncbi.nlm.nih.gov/Structure/icn3d/clinvar.txt";
    var url = "https://www.ncbi.nlm.nih.gov/Structure/vastdyn/vastdyn.cgi?chainid_clinvar=" + chnidBase;
    $.ajax({
      url: url,
      dataType: 'jsonp',
      cache: true,
      tryCount : 0,
      retryLimit : 1,
      success: function(indata) {
        if(indata && indata.data && indata.data.length > 0) {
            var bSnpOnly = false;
            var data = indata;
            me.processSnpClinvar(data, chnid, chnidBase, bSnpOnly);
        }
        else {
            me.processNoClinvar(chnid);
        }
        //if(me.deferredClinvar !== undefined) me.deferredClinvar.resolve();
      },
      error : function(xhr, textStatus, errorThrown ) {
        this.tryCount++;
        if (this.tryCount <= this.retryLimit) {
            //try again
            $.ajax(this);
            return;
        }
        me.processNoClinvar(chnid);
        //if(me.deferredClinvar !== undefined) me.deferredClinvar.resolve();
        return;
      }
    });
};
iCn3DUI.prototype.showSnp = function(chnid, chnidBase) { var me = this, ic = me.icn3d; "use strict";
    me.showSnpClinvar(chnid, chnidBase, true);
};
iCn3DUI.prototype.showClinvar = function(chnid, chnidBase) { var me = this, ic = me.icn3d; "use strict";
    me.showSnpClinvar(chnid, chnidBase, false);
};
iCn3DUI.prototype.showSnpClinvar = function(chnid, chnidBase, bSnpOnly) { var me = this, ic = me.icn3d; "use strict";
   // get gi from acc
   //var url2 = "https://www.ncbi.nlm.nih.gov/Structure/icn3d/chainid2repgi.txt";
   var url2 = me.baseUrl + "vastdyn/vastdyn.cgi?chainid=" + chnidBase;
   $.ajax({
      url: url2,
      dataType: 'jsonp', //'text',
      cache: true,
      tryCount : 0,
      retryLimit : 1,
      success: function(data2) {
        //me.chainid2repgi = JSON.parse(data2);
        //var gi = me.chainid2repgi[chnidBase];
        var snpgi = data2.snpgi;
        var gi = data2.gi;
        if(bSnpOnly) {
            me.showSnpPart2(chnid, chnidBase, snpgi);
        }
        else {
            var specialGiArray = [6137708,1942289,224510717,2624886,253723219,2554905,75765331,3660278,312207882,319443632,342350956,1827805,109157826,1065265,40889086,6730307,163931185,494469,163931091,60594093,55669745,18655489,17942684,6980537,166235465,6435586,4139398,4389047,364506122,78101667,262118402,20664221,2624640,158430173,494395,28948777,34810587,13399647,3660342,261278854,342350965,384482350,378792570,15988303,213424334,4558333,2098365,10835631,3318817,374074330,332639529,122919696,4389286,319443573,2781341,67464020,194709238,210061039,364506106,28949044,40889076,161172338,17943181,4557976,62738484,365813173,6137343,350610552,17942703,576308,223674070,15826518,1310997,93279697,4139395,255311799,157837067,361132363,357380836,146387678,383280379,1127268,299856826,13786789,1311054,46015217,3402130,381353319,30750059,218766885,340707375,27065817,355333104,2624634,62738384,241913553,304446010];
            var giUsed = snpgi;
            if(specialGiArray.includes(gi)) giUsed = gi;
            me.showClinvarPart2(chnid, chnidBase, giUsed);
        }
      },
      error : function(xhr, textStatus, errorThrown ) {
        this.tryCount++;
        if (this.tryCount <= this.retryLimit) {
            //try again
            $.ajax(this);
            return;
        }
        if(bSnpOnly) {
            me.processNoSnp(chnid);
        }
        else {
            me.processNoClinvar(chnid);
        }
        return;
      }
   });
};
iCn3DUI.prototype.showSnpPart2 = function(chnid, chnidBase, gi) { var me = this, ic = me.icn3d; "use strict";
    if(gi !== undefined) {
        var url3 = "https://www.ncbi.nlm.nih.gov/projects/SNP/beVarSearch.cgi?appname=iCn3D&format=bed&report=pdb2bed&connect=MSSNPSUBMISSION1&gi=" + gi;

        $.ajax({
          url: url3,
          dataType: 'text',
          cache: true,
          tryCount : 0,
          retryLimit : 1,
          success: function(data3) {
            if(data3) {
                var bSnpOnly = true;
                me.processSnpClinvar(data3, chnid, chnidBase, bSnpOnly);
            } //if(data3 != "") {
            else {
                var url4 = "https://www.ncbi.nlm.nih.gov/Structure/vastdyn/vastdyn.cgi?chainid_snp=" + chnidBase;
                $.ajax({
                  url: url4,
                  dataType: 'jsonp', //'text',
                  cache: true,
                  tryCount : 0,
                  retryLimit : 1,
                  success: function(data4) {
                    if(data4 && data4.data && data4.data.length > 0) {
                        var bSnpOnly = true;
                        var bVirus = true;
                        me.processSnpClinvar(data4, chnid, chnidBase, bSnpOnly, bVirus);
                    } //if(data4 != "") {
                    else {
                        me.processNoSnp(chnid);
                    }
                    //if(me.deferredSnp !== undefined) me.deferredSnp.resolve();
                  },
                  error : function(xhr, textStatus, errorThrown ) {
                    this.tryCount++;
                    if (this.tryCount <= this.retryLimit) {
                        //try again
                        $.ajax(this);
                        return;
                    }
                    me.processNoSnp(chnid);
                    //if(me.deferredSnp !== undefined) me.deferredSnp.resolve();
                    return;
                  }
                });
            }
            //if(me.deferredSnp !== undefined) me.deferredSnp.resolve();
          },
          error : function(xhr, textStatus, errorThrown ) {
            this.tryCount++;
            if (this.tryCount <= this.retryLimit) {
                //try again
                $.ajax(this);
                return;
            }
            me.processNoSnp(chnid);
            //if(me.deferredSnp !== undefined) me.deferredSnp.resolve();
            return;
          }
        });
    }
    else {
        me.processNoSnp(chnid);
        console.log( "No gi was found for the chain " + chnidBase + "..." );
    }
};
iCn3DUI.prototype.processNoClinvar = function(chnid) { var me = this, ic = me.icn3d; "use strict";
        console.log( "No ClinVar data were found for the protein " + chnid + "..." );
        $("#" + me.pre + 'dt_clinvar_' + chnid).html('');
        $("#" + me.pre + 'ov_clinvar_' + chnid).html('');
        me.enableHlSeq();
        me.bAjaxClinvar = true;
        if(me.deferredClinvar !== undefined) me.deferredClinvar.resolve();
};
iCn3DUI.prototype.processNoSnp = function(chnid) { var me = this, ic = me.icn3d; "use strict";
        console.log( "No SNP data were found for the protein " + chnid + "..." );
        $("#" + me.pre + 'dt_snp_' + chnid).html('');
        $("#" + me.pre + 'ov_snp_' + chnid).html('');
        me.enableHlSeq();
        me.bAjaxSnp = true;
        if(me.deferredSnp !== undefined) me.deferredSnp.resolve();
};
iCn3DUI.prototype.showCddSiteAll = function() { var me = this, ic = me.icn3d; "use strict";
    var chnidBaseArray = $.map(me.protein_chainid, function(v) { return v; });
    var chnidArray = Object.keys(me.protein_chainid);
    // show conserved domains and binding sites
    var url = me.baseUrl + "cdannots/cdannots.fcgi?fmt&queries=" + chnidBaseArray;
    $.ajax({
      url: url,
      dataType: 'jsonp',
      cache: true,
      tryCount : 0,
      retryLimit : 1,
      success: function(data) {
          var chainWithData = {};
          for(var chainI = 0, chainLen = data.data.length; chainI < chainLen; ++chainI) {
            var cddData = data.data[chainI];
            var chnidBase = cddData._id;
            //var pos = chnidBaseArray.indexOf(chnidBase);
            //var chnid = chnidArray[pos];
            var chnid = chnidArray[chainI];
            chainWithData[chnid] = 1;
            var html = '<div id="' + me.pre + chnid + '_cddseq_sequence" class="icn3d-cdd icn3d-dl_sequence">';
            var html2 = html;
            var html3 = html;
            var domainArray = cddData.doms;
            var indexl = (domainArray !== undefined) ? domainArray.length : 0;
            for(var index = 0; index < indexl; ++index) {
                var acc = domainArray[index].acc;
                var type = domainArray[index].type;
                type = 'domain';
                var domain = domainArray[index].title.split(':')[0];
                var defline = domainArray[index].defline;
                var title = type + ': ' + domain;
                if(title.length > 14) title = title.substr(0, 14) + '...';
                var fulltitle = type + ": " + domain;
                // each domain may have several repeat. Treat each repeat as a domain
                var domainRepeatArray = domainArray[index].locs;
                for(var r = 0, rl = domainRepeatArray.length; r < rl; ++r) {
                    // each domain repeat or domain may have several segments, i.e., a domain may not be continous
                    var fromArray = [], toArray = [];
                    var resiHash = {};
                    var resCnt = 0;
                    for(var s = 0, sl = domainRepeatArray[r].segs.length; s < sl; ++s) {
                        var domainFrom = Math.round(domainRepeatArray[r].segs[s].from);
                        var domainTo = Math.round(domainRepeatArray[r].segs[s].to);
                        fromArray.push(domainFrom + me.baseResi[chnid]);
                        toArray.push(domainTo + me.baseResi[chnid]);
                        for(var i = domainFrom; i <= domainTo; ++i) {
                            resiHash[i] = 1;
                        }
                        resCnt += domainTo - domainFrom + 1;
                    }
                    var htmlTmp2 = '<div class="icn3d-seqTitle icn3d-link icn3d-blue" domain="' + acc + '" from="' + fromArray + '" to="' + toArray + '" shorttitle="' + title + '" setname="' + chnid + '_' + type + '_' + index + '_' + r + '" anno="sequence" chain="' + chnid + '" title="' + fulltitle + '">' + title + ' </div>';
                    var htmlTmp3 = '<span class="icn3d-residueNum" title="residue count">' + resCnt.toString() + ' Res</span>';
                    html3 += htmlTmp2 + htmlTmp3 + '<br>';
                    var htmlTmp = '<span class="icn3d-seqLine">';
                    html += htmlTmp2 + htmlTmp3 + htmlTmp;
                    html2 += '<div style="width:20px; display:inline-block;"><span id="' + me.pre + chnid + '_' + acc + '_' + r + '_cddseq_expand" class="ui-icon ui-icon-plus icn3d-expand icn3d-link" style="width:15px;" title="Expand"></span><span id="' + me.pre + chnid + '_' + acc + '_' + r + '_cddseq_shrink" class="ui-icon ui-icon-minus icn3d-shrink icn3d-link" style="display:none; width:15px;" title="Shrink"></span></div>';
                    html2 += '<div style="width:100px!important;" class="icn3d-seqTitle icn3d-link icn3d-blue" domain="' + acc + '" from="' + fromArray + '" to="' + toArray + '" shorttitle="' + title + '" index="' + index + '" setname="' + chnid + '_' + type + '_' + index + '_' + r + '" anno="sequence" chain="' + chnid + '" title="' + fulltitle + '">' + title + ' </div>';
                    html2 += htmlTmp3 + htmlTmp;
                    var pre = type + index.toString();
                    for(var i = 0, il = me.giSeq[chnid].length; i < il; ++i) {
                      html += me.insertGap(chnid, i, '-');
                      if(resiHash.hasOwnProperty(i)) {
                        var cFull = me.giSeq[chnid][i];
                          var c = cFull;
                          if(cFull.length > 1) {
                              c = cFull[0] + '..';
                          }
        //                var pos = (me.baseResi[chnid] + i+1).toString();
        //                var pos = ic.chainsSeq[chnid][i - me.matchedPos[chnid] ].resi
                          var pos = (i >= me.matchedPos[chnid] && i - me.matchedPos[chnid] < ic.chainsSeq[chnid].length) ? ic.chainsSeq[chnid][i - me.matchedPos[chnid]].resi : me.baseResi[chnid] + 1 + i;
                        html += '<span id="' + pre + '_' + me.pre + chnid + '_' + pos + '" title="' + c + pos + '" class="icn3d-residue">' + cFull + '</span>';
                      }
                      else {
                        html += '<span>-</span>'; //'<span>-</span>';
                      }
                    }
                    var atom = ic.getFirstCalphaAtomObj(ic.chains[chnid]);
                    var colorStr = (atom.color === undefined || atom.color.getHexString() === 'FFFFFF') ? 'DDDDDD' : atom.color.getHexString();
                    var color = (atom.color !== undefined) ? colorStr : "CCCCCC";
                    if(me.cfg.blast_rep_id != chnid) { // regular
                        for(var i = 0, il = fromArray.length; i < il; ++i) {
                            var emptyWidth = (i == 0) ? Math.round(me.seqAnnWidth * (fromArray[i] - me.baseResi[chnid] - 1) / me.maxAnnoLength) : Math.round(me.seqAnnWidth * (fromArray[i] - toArray[i-1] - 1) / me.maxAnnoLength);
                            html2 += '<div style="display:inline-block; width:' + emptyWidth + 'px;">&nbsp;</div>';
                            html2 += '<div style="display:inline-block; color:white!important; font-weight:bold; background-color:#' + color + '; width:' + Math.round(me.seqAnnWidth * (toArray[i] - fromArray[i] + 1) / me.maxAnnoLength) + 'px;" class="icn3d-seqTitle icn3d-link icn3d-blue" domain="' + (index+1).toString() + '" from="' + fromArray + '" to="' + toArray + '" shorttitle="' + title + '" index="' + index + '" setname="' + chnid + '_domain_' + index + '_' + r + '" id="' + chnid + '_domain_' + index + '_' + r + '" anno="sequence" chain="' + chnid + '" title="' + fulltitle + '">' + domain + ' </div>';
                        }
                    }
                    else { // with potential gaps
                        var fromArray2 = [], toArray2 = [];
                        for(var i = 0, il = fromArray.length; i < il; ++i) {
                            fromArray2.push(fromArray[i]);
                            for(var j = fromArray[i]; j <= toArray[i]; ++j) {
                                if(me.targetGapHash !== undefined && me.targetGapHash.hasOwnProperty(j)) {
                                    toArray2.push(j - 1);
                                    fromArray2.push(j);
                                }
                            }
                            toArray2.push(toArray[i]);
                        }
                        for(var i = 0, il = fromArray2.length; i < il; ++i) {
                            html2 += me.insertGapOverview(chnid, fromArray2[i]);
                            var emptyWidth = (i == 0) ? Math.round(me.seqAnnWidth * (fromArray2[i] - me.baseResi[chnid] - 1) / (me.maxAnnoLength + me.nTotalGap)) : Math.round(me.seqAnnWidth * (fromArray2[i] - toArray2[i-1] - 1) / (me.maxAnnoLength + me.nTotalGap));
                            html2 += '<div style="display:inline-block; width:' + emptyWidth + 'px;">&nbsp;</div>';
                            html2 += '<div style="display:inline-block; color:white!important; font-weight:bold; background-color:#' + color + '; width:' + Math.round(me.seqAnnWidth * (toArray2[i] - fromArray2[i] + 1) / (me.maxAnnoLength + me.nTotalGap)) + 'px;" class="icn3d-seqTitle icn3d-link icn3d-blue" domain="' + (index+1).toString() + '" from="' + fromArray2 + '" to="' + toArray2 + '" shorttitle="' + title + '" index="' + index + '" setname="' + chnid + '_domain_' + index + '_' + r + '" id="' + chnid + '_domain_' + index + '_' + r + '" anno="sequence" chain="' + chnid + '" title="' + fulltitle + '">' + domain + ' </div>';
                        }
                    }
                    htmlTmp = '<span class="icn3d-residueNum" title="residue count">&nbsp;' + resCnt.toString() + ' Residues</span>';
                    htmlTmp += '</span>';
                    htmlTmp += '<br>';
                    html += htmlTmp;
                    html2 += htmlTmp;
                    html2 += '<div id="' + me.pre + chnid + '_' + acc + '_' + r + '_cddseq" style="display:none; white-space:normal;" class="icn3d-box">' + defline + ' (<a href="' + me.baseUrl + 'cdd/cddsrv.cgi?uid=' + acc + '" target="_blank" class="icn3d-blue">open details view...</a>)</div>';
                } // for(var r = 0,
            }
            html += '</div>';
            html2 += '</div>';
            html3 += '</div>';
            $("#" + me.pre + "dt_cdd_" + chnid).html(html);
            $("#" + me.pre + "ov_cdd_" + chnid).html(html2);
            $("#" + me.pre + "tt_cdd_" + chnid).html(html3);
            html = '<div id="' + me.pre + chnid + '_siteseq_sequence" class="icn3d-dl_sequence">';
            html2 = html;
            html3 = html;
            var siteArray = data.data[chainI].sites;
            indexl = (siteArray !== undefined) ? siteArray.length : 0;
            for(var index = 0; index < indexl; ++index) {
                var domain = siteArray[index].srcdom;
                var type = siteArray[index].type;
                var resCnt = siteArray[index].sz;
                var title = 'site: ' + siteArray[index].title;
                if(title.length > 17) title = title.substr(0, 17) + '...';
                //var fulltitle = "site: " + siteArray[index].title + " (domain: " + domain + ")";
                var fulltitle = siteArray[index].title;
                var resPosArray, adjustedResPosArray = [];
                for(var i = 0, il = siteArray[index].locs.length; i < il; ++i) {
                    resPosArray = siteArray[index].locs[i].coords;
                    for(var j = 0, jl = resPosArray.length; j < jl; ++j) {
                        adjustedResPosArray.push(Math.round(resPosArray[j]) + me.baseResi[chnid]);
                    }
                }
                var htmlTmp2 = '<div class="icn3d-seqTitle icn3d-link icn3d-blue" site="site" posarray="' + adjustedResPosArray.toString() + '" shorttitle="' + title + '" setname="' + chnid + '_site_' + index + '" anno="sequence" chain="' + chnid + '" title="' + fulltitle + '">' + title + ' </div>';
                var htmlTmp3 = '<span class="icn3d-residueNum" title="residue count">' + resCnt.toString() + ' Res</span>';
                var htmlTmp = '<span class="icn3d-seqLine">';
                html3 += htmlTmp2 + htmlTmp3 + '<br>';
                html += htmlTmp2 + htmlTmp3 + htmlTmp;
                html2 += htmlTmp2 + htmlTmp3 + htmlTmp;
                var pre = 'site' + index.toString();
                //var widthPerRes = me.seqAnnWidth / me.maxAnnoLength;
                var prevEmptyWidth = 0;
                var prevLineWidth = 0;
                var widthPerRes = 1;
                for(var i = 0, il = me.giSeq[chnid].length; i < il; ++i) {
                  html += me.insertGap(chnid, i, '-');
                  if(resPosArray.indexOf(i) != -1) {
                    var cFull = me.giSeq[chnid][i];
                      var c = cFull;
                      if(cFull.length > 1) {
                          c = cFull[0] + '..';
                      }
    //                var pos = (me.baseResi[chnid] + i+1).toString();
    //                var pos = ic.chainsSeq[chnid][i - me.matchedPos[chnid] ].resi;
                      var pos = (i >= me.matchedPos[chnid] && i - me.matchedPos[chnid] < ic.chainsSeq[chnid].length) ? ic.chainsSeq[chnid][i - me.matchedPos[chnid]].resi : me.baseResi[chnid] + 1 + i;
                    html += '<span id="' + pre + '_' + me.pre + chnid + '_' + pos + '" title="' + c + pos + '" class="icn3d-residue">' + cFull + '</span>';
                    html2 += me.insertGapOverview(chnid, i);
                    var emptyWidth = (me.cfg.blast_rep_id == chnid) ? Math.round(me.seqAnnWidth * i / (me.maxAnnoLength + me.nTotalGap) - prevEmptyWidth - prevLineWidth) : Math.round(me.seqAnnWidth * i / me.maxAnnoLength - prevEmptyWidth - prevLineWidth);
                    //if(emptyWidth < 0) emptyWidth = 0;
                    if(emptyWidth >= 0) {
                    html2 += '<div style="display:inline-block; width:' + emptyWidth + 'px;">&nbsp;</div>';
                    html2 += '<div style="display:inline-block; background-color:#000; width:' + widthPerRes + 'px;" title="' + c + pos + '">&nbsp;</div>';
                    prevEmptyWidth += emptyWidth;
                    prevLineWidth += widthPerRes;
                    }
                  }
                  else {
                    html += '<span>-</span>'; //'<span>-</span>';
                  }
                }
                htmlTmp = '<span class="icn3d-residueNum" title="residue count">&nbsp;' + resCnt.toString() + ' Residues</span>';
                htmlTmp += '</span>';
                htmlTmp += '<br>';
                html += htmlTmp;
                html2 += htmlTmp;
            }
            html += '</div>';
            html2 += '</div>';
            html3 += '</div>';
            $("#" + me.pre + "dt_site_" + chnid).html(html);
            $("#" + me.pre + "ov_site_" + chnid).html(html2);
            $("#" + me.pre + "tt_site_" + chnid).html(html3);
        } // outer for loop
        // missing CDD data
        for(var chnid in me.protein_chainid) {
            if(!chainWithData.hasOwnProperty(chnid)) {
                $("#" + me.pre + "dt_cdd_" + chnid).html('');
                $("#" + me.pre + "ov_cdd_" + chnid).html('');
                $("#" + me.pre + "tt_cdd_" + chnid).html('');
                $("#" + me.pre + "dt_site_" + chnid).html('');
                $("#" + me.pre + "ov_site_" + chnid).html('');
                $("#" + me.pre + "tt_site_" + chnid).html('');
            }
        }
        // add here after the ajax call
        me.enableHlSeq();
        me.bAjaxCddSite = true;
        if(me.deferredAnnoCddSite !== undefined) me.deferredAnnoCddSite.resolve();
      },
      error : function(xhr, textStatus, errorThrown ) {
        this.tryCount++;
        if (this.tryCount <= this.retryLimit) {
            //try again
            $.ajax(this);
            return;
        }
        console.log( "No CDD data were found for the protein " + chnidBaseArray + "..." );
        for(var chnid in me.protein_chainid) {
            $("#" + me.pre + "dt_cdd_" + chnid).html('');
            $("#" + me.pre + "ov_cdd_" + chnid).html('');
            $("#" + me.pre + "tt_cdd_" + chnid).html('');
            $("#" + me.pre + "dt_site_" + chnid).html('');
            $("#" + me.pre + "ov_site_" + chnid).html('');
            $("#" + me.pre + "tt_site_" + chnid).html('');
        }
        // add here after the ajax call
        me.enableHlSeq();
        me.bAjaxCddSite = true;
        if(me.deferredAnnoCddSite !== undefined) me.deferredAnnoCddSite.resolve();
        return;
      }
    });
};
iCn3DUI.prototype.showDomainPerStructure = function(index) { var me = this, ic = me.icn3d; "use strict";
    //var chnid = Object.keys(me.protein_chainid)[0];
    //var pdbid = chnid.substr(0, chnid.indexOf('_'));
    var pdbArray = Object.keys(ic.structures);
    // show 3D domains
    var pdbid = pdbArray[index];
    var url = me.baseUrl + "mmdb/mmdb_strview.cgi?v=2&program=icn3d&domain&molinfor&uid=" + pdbid;
    if(index == 0 && me.mmdb_data !== undefined) {
        for(var chnid in me.protein_chainid) {
            if(chnid.indexOf(pdbid) !== -1) {
                me.showDomainWithData(chnid, me.mmdb_data);
            }
        }
    }
    else if(me.mmdb_dataArray[index] !== undefined) {
        for(var chnid in me.protein_chainid) {
            if(chnid.indexOf(pdbid) !== -1) {
                me.showDomainWithData(chnid, me.mmdb_dataArray[index]);
            }
        }
    }
    else {
        $.ajax({
          url: url,
          dataType: 'json',
          cache: true,
          tryCount : 0,
          retryLimit : 1,
          success: function(data) {
            me.mmdb_dataArray[index] = data;
            for(var chnid in me.protein_chainid) {
                if(chnid.indexOf(pdbid) !== -1) {
                    me.showDomainWithData(chnid, me.mmdb_dataArray[index]);
                }
            }
            // add here after the ajax call
            me.enableHlSeq();
            me.bAjax3ddomain = true;
            me.bAjaxDoneArray[index] = true;
            if(me.deferred3ddomain !== undefined) {
                if(me.cfg.align === undefined || me.cfg.chainalign === undefined || me.bRealign) {
                    me.deferred3ddomain.resolve();
                }
                else {
                    var bAjaxDoneAll = true;
                    for(var i = 0, il = pdbArray.length; i < il; ++i) {
                        bAjaxDoneAll = bAjaxDoneAll && me.bAjaxDoneArray[i];
                    }
                    if(bAjaxDoneAll) me.deferred3ddomain.resolve();
                }
            }
          },
          error : function(xhr, textStatus, errorThrown ) {
            this.tryCount++;
            if (this.tryCount <= this.retryLimit) {
                //try again
                $.ajax(this);
                return;
            }
            console.log( "No 3D domain data were found for the protein " + pdbid + "..." );
            for(var chnid in me.protein_chainid) {
                if(chnid.indexOf(pdbid) !== -1) {
                    $("#" + me.pre + "dt_domain_" + chnid).html('');
                    $("#" + me.pre + "ov_domain_" + chnid).html('');
                    $("#" + me.pre + "tt_domain_" + chnid).html('');
                }
            }
            me.enableHlSeq();
            me.bAjax3ddomain = true;
            bAjaxDone1 = true;
            if(me.deferred3ddomain !== undefined) {
                if(me.cfg.align === undefined || me.cfg.chainalign === undefined) {
                    me.deferred3ddomain.resolve();
                }
                else {
                    var bAjaxDoneAll = true;
                    for(var i = 0, il = pdbArray.length; i < il; ++i) {
                        bAjaxDoneAll = bAjaxDoneAll && me.bAjaxDoneArray[i];
                    }
                    if(bAjaxDoneAll) me.deferred3ddomain.resolve();
                }
            }
            return;
          }
        });
    }
};
iCn3DUI.prototype.showDomainAll = function() { var me = this, ic = me.icn3d; "use strict";
    //var chnid = Object.keys(me.protein_chainid)[0];
    //var pdbid = chnid.substr(0, chnid.indexOf('_'));
    var pdbArray = Object.keys(ic.structures);
    // show 3D domains
    me.mmdb_dataArray = [];
    me.bAjaxDoneArray = [];
    for(var i = 0, il = pdbArray.length; i < il; ++i) {
        me.bAjaxDoneArray[i] = false;
    }
    for(var i = 0, il = pdbArray.length; i < il; ++i) {
        me.showDomainPerStructure(i);
    }
};
iCn3DUI.prototype.showDomainWithData = function(chnid, data) { var me = this, ic = me.icn3d; "use strict";
        var html = '<div id="' + me.pre + chnid + '_domainseq_sequence" class="icn3d-dl_sequence">';
        var html2 = html;
        var html3 = html;
        var domainArray, proteinname;
        var pos = chnid.indexOf('_');
        var chain = chnid.substr(pos + 1);
        var molinfo = data.moleculeInfor;
        var currMolid;
        for(var molid in molinfo) {
        if(molinfo[molid].chain === chain) {
          currMolid = molid;
          proteinname = molinfo[molid].name;
          break;
        }
        }
        if(currMolid !== undefined && data.domains[currMolid] !== undefined) {
          domainArray = data.domains[currMolid].domains;
        }
        if(domainArray === undefined) {
          domainArray = [];
        }
        for(var index = 0, indexl = domainArray.length; index < indexl; ++index) {
            //var fulltitle = '3D domain ' + (index+1).toString() + ' of ' + proteinname + ' (PDB ID: ' + data.pdbId + ')';
            var fulltitle = '3D domain ' + (index+1).toString() + ' of ' + proteinname;
            var title = (fulltitle.length > 17) ? fulltitle.substr(0,17) + '...' : fulltitle;
            var subdomainArray = domainArray[index].intervals;
            // remove duplicate, e.g., at https://www.ncbi.nlm.nih.gov/Structure/mmdb/mmdb_strview.cgi?v=2&program=icn3d&domain&molinfor&uid=1itw
            var domainFromHash = {}, domainToHash = {};
            var fromArray = [], toArray = [];
            var resiHash = {};
            var resCnt = 0
            for(var i = 0, il = subdomainArray.length; i < il; ++i) {
                var domainFrom = Math.round(subdomainArray[i][0]) - 1; // 1-based
                var domainTo = Math.round(subdomainArray[i][1]) - 1;
                if(domainFromHash.hasOwnProperty(domainFrom) || domainToHash.hasOwnProperty(domainTo)) {
                    continue; // do nothing for duplicated "from" or "to", e.g, PDBID 1ITW, 5FWI
                }
                else {
                    domainFromHash[domainFrom] = 1;
                    domainToHash[domainTo] = 1;
                }
                fromArray.push(domainFrom + me.baseResi[chnid]);
                toArray.push(domainTo + me.baseResi[chnid]);
                resCnt += domainTo - domainFrom + 1;
                for(var j = domainFrom; j <= domainTo; ++j) {
                    resiHash[j+1] = 1;
                }
            }
            var htmlTmp2 = '<div class="icn3d-seqTitle icn3d-link icn3d-blue" 3ddomain="' + (index+1).toString() + '" from="' + fromArray + '" to="' + toArray + '" shorttitle="' + title + '" index="' + index + '" setname="' + chnid + '_3d_domain_' + (index+1).toString() + '" anno="sequence" chain="' + chnid + '" title="' + fulltitle + '">' + title + ' </div>';
            var htmlTmp3 = '<span class="icn3d-residueNum" title="residue count">' + resCnt.toString() + ' Res</span>';
            html3 += htmlTmp2 + htmlTmp3 + '<br>';
            var htmlTmp = '<span class="icn3d-seqLine">';
            html += htmlTmp2 + htmlTmp3 + htmlTmp;
            html2 += htmlTmp2 + htmlTmp3 + htmlTmp;
            var pre = 'domain3d' + index.toString();
            for(var i = 0, il = me.giSeq[chnid].length; i < il; ++i) {
              html += me.insertGap(chnid, i, '-');
              //if(i >= domainFrom && i <= domainTo) {
              if(resiHash.hasOwnProperty(i+1)) {
                var cFull = me.giSeq[chnid][i];
                  var c = cFull;
                  if(cFull.length > 1) {
                      c = cFull[0] + '..';
                  }
//                var pos = (me.baseResi[chnid] + i+1).toString();
//                var pos = ic.chainsSeq[chnid][i - me.matchedPos[chnid] ].resi;
                  var pos = (i >= me.matchedPos[chnid] && i - me.matchedPos[chnid] < ic.chainsSeq[chnid].length) ? ic.chainsSeq[chnid][i - me.matchedPos[chnid]].resi : me.baseResi[chnid] + 1 + i;
                html += '<span id="' + pre + '_' + me.pre + chnid + '_' + pos + '" title="' + c + pos + '" class="icn3d-residue">' + cFull + '</span>';
              }
              else {
                html += '<span>-</span>'; //'<span>-</span>';
              }
            }
            var atom = ic.getFirstCalphaAtomObj(ic.chains[chnid]);
            var colorStr = (atom.color === undefined || atom.color.getHexString() === 'FFFFFF') ? 'DDDDDD' : atom.color.getHexString();
            var color = (atom.color !== undefined) ? colorStr : "CCCCCC";
            if(me.cfg.blast_rep_id != chnid) { // regular
                for(var i = 0, il = fromArray.length; i < il; ++i) {
                    var emptyWidth = (i == 0) ? Math.round(me.seqAnnWidth * (fromArray[i] - me.baseResi[chnid] - 1) / me.maxAnnoLength) : Math.round(me.seqAnnWidth * (fromArray[i] - toArray[i-1] - 1) / me.maxAnnoLength);
                    html2 += '<div style="display:inline-block; width:' + emptyWidth + 'px;">&nbsp;</div>';
                    html2 += '<div style="display:inline-block; color:white!important; font-weight:bold; background-color:#' + color + '; width:' + Math.round(me.seqAnnWidth * (toArray[i] - fromArray[i] + 1) / me.maxAnnoLength) + 'px;" class="icn3d-seqTitle icn3d-link icn3d-blue" 3ddomain="' + (index+1).toString() + '" from="' + fromArray + '" to="' + toArray + '" shorttitle="' + title + '" index="' + index + '" setname="' + chnid + '_3d_domain_' + (index+1).toString() + '" id="' + chnid + '_3d_domain_' + index + '" anno="sequence" chain="' + chnid + '" title="' + fulltitle + '">3D domain ' + (index+1).toString() + '</div>';
                }
            }
            else { // with potential gaps
                var fromArray2 = [], toArray2 = [];
                for(var i = 0, il = fromArray.length; i < il; ++i) {
                    fromArray2.push(fromArray[i]);
                    for(var j = fromArray[i]; j <= toArray[i]; ++j) {
                        if(me.targetGapHash !== undefined && me.targetGapHash.hasOwnProperty(j)) {
                            toArray2.push(j - 1);
                            fromArray2.push(j);
                        }
                    }
                    toArray2.push(toArray[i]);
                }
                for(var i = 0, il = fromArray2.length; i < il; ++i) {
                    html2 += me.insertGapOverview(chnid, fromArray2[i]);
                    var emptyWidth = (i == 0) ? Math.round(me.seqAnnWidth * (fromArray2[i] - me.baseResi[chnid] - 1) / (me.maxAnnoLength + me.nTotalGap)) : Math.round(me.seqAnnWidth * (fromArray2[i] - toArray2[i-1] - 1) / (me.maxAnnoLength + me.nTotalGap));
                    html2 += '<div style="display:inline-block; width:' + emptyWidth + 'px;">&nbsp;</div>';
                    html2 += '<div style="display:inline-block; color:white!important; font-weight:bold; background-color:#' + color + '; width:' + Math.round(me.seqAnnWidth * (toArray2[i] - fromArray2[i] + 1) / (me.maxAnnoLength + me.nTotalGap)) + 'px;" class="icn3d-seqTitle icn3d-link icn3d-blue" 3ddomain="' + (index+1).toString() + '" from="' + fromArray2 + '" to="' + toArray2 + '" shorttitle="' + title + '" index="' + index + '" setname="' + chnid + '_3d_domain_' + (index+1).toString() + '" id="' + chnid + '_3d_domain_' + index + '" anno="sequence" chain="' + chnid + '" title="' + fulltitle + '">3D domain ' + (index+1).toString() + '</div>';
                }
            }
            htmlTmp = '<span class="icn3d-residueNum" title="residue count">&nbsp;' + resCnt.toString() + ' Residues</span>';
            htmlTmp += '</span>';
            htmlTmp += '<br>';
            html += htmlTmp;
            html2 += htmlTmp;
        }
        html += '</div>';
        html2 += '</div>';
        html3 += '</div>';
        $("#" + me.pre + "dt_domain_" + chnid).html(html);
        $("#" + me.pre + "ov_domain_" + chnid).html(html2);
        $("#" + me.pre + "tt_domain_" + chnid).html(html3);
};
iCn3DUI.prototype.showInteraction = function(chnid, chnidBase) { var me = this, ic = me.icn3d; "use strict";
    if(me.chainname2residues === undefined && (me.cfg.mmdbid !== undefined || me.cfg.gi !== undefined || me.cfg.blast_rep_id !== undefined || me.cfg.align !== undefined || me.cfg.chainalign !== undefined) ) {
        // 2d interaction didn't finish loading data yet
        setTimeout(function(){
          me.showInteraction_base(chnid, chnidBase);
        }, 1000);
    }
    else {
        me.showInteraction_base(chnid, chnidBase);
    }
};
iCn3DUI.prototype.showInteraction_base = function(chnid, chnidBase) { var me = this, ic = me.icn3d; "use strict";
    // set interaction
    if(me.chainname2residues === undefined) me.chainname2residues = {};
    var radius = 4;
    var chainArray = Object.keys(ic.chains);
    var chainid = chnid;
    var pos = Math.round(chainid.indexOf('_'));
    if(pos > 4) return; // NMR structures with structure id such as 2K042,2K043, ...
    var atom = ic.getFirstCalphaAtomObj(ic.chains[chainid]);
    if(me.chainname2residues[chainid] === undefined) {
        me.chainname2residues[chainid] = {};
        var jl = chainArray.length;
        if(jl > 100 && me.cfg.mmdbid === undefined && me.cfg.gi === undefined && me.cfg.blast_rep_id === undefined && me.cfg.align === undefined && me.cfg.chainalign === undefined) {
        //if(jl > 100) {
            //console.log("Do not show interactions if there are more than 100 chains");
            $("#" + me.pre + "dt_interaction_" + chnid).html("");
            $("#" + me.pre + "ov_interaction_" + chnid).html("");
            return; // skip interactions if there are more than 100 chains
        }
        for(var j = 0; j < jl; ++j) {
            var chainid2 = chainArray[j];
            if(chainid2 === chainid) continue;
            // interactions should be on the same structure
            if(chainid2.substr(0, chainid2.indexOf('_')) !== chainid.substr(0, chainid.indexOf('_'))) continue;
            pos = Math.round(chainid.indexOf('_'));
            if(pos > 4) continue; // NMR structures with structure id such as 2K042,2K043, ...
            var atom2 = ic.getFirstCalphaAtomObj(ic.chains[chainid2]);
            //if(me.chainname2residues[chainid2] === undefined) me.chainname2residues[chainid2] = {};
            var type2;
            if(ic.chemicals.hasOwnProperty(atom2.serial)) { // 1. chemical interacting with proteins
                type2 = 'chemical';
            }
            else if(ic.nucleotides.hasOwnProperty(atom2.serial)) { // 2. DNA interacting with proteins
                type2 = 'nucleotide';
            }
            else if(ic.ions.hasOwnProperty(atom2.serial)) { // 3. ions interacting with proteins
                type2 = 'ion';
            }
            else if(ic.proteins.hasOwnProperty(atom2.serial)) { // 4. protein interacting with proteins
                type2 = 'protein';
            }
            else if(ic.water.hasOwnProperty(atom2.serial)) { // 5. water interacting with proteins
                type2 = 'water';
            }
            // find atoms in chainid1, which interact with chainid2
            var atomsChainid1 = ic.getAtomsWithinAtom(ic.hash2Atoms(ic.chains[chainid]), ic.hash2Atoms(ic.chains[chainid2]), radius);
            if(Object.keys(atomsChainid1).length == 0) continue;
            var residues = {};
            for (var k in atomsChainid1) {
                var atom = ic.atoms[k];
                var residueid = atom.structure + '_' + atom.chain + '_' + atom.resi;
                residues[residueid] = 1;
            }
            var name = chainid2.substr(chainid2.indexOf('_') + 1) + " (" + type2 + ")";
            me.chainname2residues[chainid][name] = Object.keys(residues);
        } // for
    }
    var html = '<div id="' + me.pre + chnid + '_interseq_sequence" class="icn3d-dl_sequence">';
    var html2 = html;
    var html3 = html;
    var index = 0;
    for(var chainname in me.chainname2residues[chnid]) {
        var residueArray = me.chainname2residues[chnid][chainname];
        var title = "Interact ." + chainname;
        if(title.length > 17) title = title.substr(0, 17) + '...';
        var fulltitle = "Interact ." + chainname;
        var resPosArray = [];
        for(var i = 0, il = residueArray.length; i < il; ++i) {
            var resid = residueArray[i];
            var resi = Math.round(resid.substr(residueArray[i].lastIndexOf('_') + 1) );
            // exclude chemical, water and ions
            var serial = Object.keys(ic.residues[resid])[0];
            if(ic.proteins.hasOwnProperty(serial) || ic.nucleotides.hasOwnProperty(serial)) {
                resPosArray.push( resi );
            }
        }
        var resCnt = resPosArray.length;
        if(resCnt == 0) continue;
        var chainnameNospace = chainname.replace(/\s/g, '');
        var htmlTmp2 = '<div class="icn3d-seqTitle icn3d-link icn3d-blue" interaction="' + (index+1).toString() + '" posarray="' + resPosArray.toString() + '" shorttitle="' + title + '" setname="' + chnid + '_' + chainnameNospace + '" anno="sequence" chain="' + chnid + '" title="' + fulltitle + '">' + title + ' </div>';
        var htmlTmp3 = '<span class="icn3d-residueNum" title="residue count">' + resCnt.toString() + ' Res</span>';
        html3 += htmlTmp2 + htmlTmp3 + '<br>';
        var htmlTmp = '<span class="icn3d-seqLine">';
        html += htmlTmp2 + htmlTmp3 + htmlTmp;
        html2 += htmlTmp2 + htmlTmp3 + htmlTmp;
        var pre = 'inter' + index.toString();
        var prevEmptyWidth = 0;
        var prevLineWidth = 0;
        var widthPerRes = 1;
        for(var i = 0, il = me.giSeq[chnid].length; i < il; ++i) {
          html += me.insertGap(chnid, i, '-');
          if(resPosArray.indexOf(i+1 + me.baseResi[chnid]) != -1) {
              var cFull = me.giSeq[chnid][i];
              var c = cFull;
              if(cFull.length > 1) {
                  c = cFull[0] + '..';
              }
//            var pos = (me.baseResi[chnid] + i+1).toString();
//            var pos = ic.chainsSeq[chnid][i - me.matchedPos[chnid] ].resi;
              var pos = (i >= me.matchedPos[chnid] && i - me.matchedPos[chnid] < ic.chainsSeq[chnid].length) ? ic.chainsSeq[chnid][i - me.matchedPos[chnid]].resi : me.baseResi[chnid] + 1 + i;
              html += '<span id="' + pre + '_' + me.pre + chnid + '_' + pos + '" title="' + cFull + pos + '" class="icn3d-residue">' + c + '</span>';
              html2 += me.insertGapOverview(chnid, i);
              var emptyWidth = (me.cfg.blast_rep_id == chnid) ? Math.round(me.seqAnnWidth * i / (me.maxAnnoLength + me.nTotalGap) - prevEmptyWidth - prevLineWidth) : Math.round(me.seqAnnWidth * i / me.maxAnnoLength - prevEmptyWidth - prevLineWidth);
                //if(emptyWidth < 0) emptyWidth = 0;
                if(emptyWidth >= 0) {
                html2 += '<div style="display:inline-block; width:' + emptyWidth + 'px;">&nbsp;</div>';
                html2 += '<div style="display:inline-block; background-color:#000; width:' + widthPerRes + 'px;" title="' + c + pos + '">&nbsp;</div>';
                prevEmptyWidth += emptyWidth;
                prevLineWidth += widthPerRes;
                }
          }
          else {
            html += '<span>-</span>'; //'<span>-</span>';
          }
        }
        htmlTmp = '<span class="icn3d-residueNum" title="residue count">&nbsp;' + resCnt.toString() + ' Residues</span>';
        htmlTmp += '</span>';
        htmlTmp += '<br>';
        html += htmlTmp;
        html2 += htmlTmp;
        ++index;
    }
    html += '</div>';
    html2 += '</div>';
    html3 += '</div>';
    $("#" + me.pre + "dt_interaction_" + chnid).html(html);
    $("#" + me.pre + "ov_interaction_" + chnid).html(html2);
    $("#" + me.pre + "tt_interaction_" + chnid).html(html3);
    // add here after the ajax call
    if(! me.isMobile()) {
        me.selectSequenceNonMobile();
    }
    else {
        me.selectSequenceMobile();
        me.selectChainMobile();
    }
};
iCn3DUI.prototype.showSsbond = function(chnid, chnidBase) { var me = this, ic = me.icn3d; "use strict";
    if(ic.ssbondpnts === undefined) {
        // didn't finish loading atom data yet
        setTimeout(function(){
          me.showSsbond_base(chnid, chnidBase);
        }, 1000);
    }
    else {
        me.showSsbond_base(chnid, chnidBase);
    }
};
iCn3DUI.prototype.showSsbond_base = function(chnid, chnidBase) { var me = this, ic = me.icn3d; "use strict";
    var chainid = chnidBase;
    var resid2resids = {};
    var structure = chainid.substr(0, chainid.indexOf('_'));
    var ssbondArray = ic.ssbondpnts[structure];
    if(ssbondArray === undefined) {
        $("#" + me.pre + "dt_ssbond_" + chnid).html('');
        $("#" + me.pre + "ov_ssbond_" + chnid).html('');
        $("#" + me.pre + "tt_ssbond_" + chnid).html('');
        return;
    }
    for(var i = 0, il = ssbondArray.length; i < il; i = i + 2) {
        var resid1 = ssbondArray[i];
        var resid2 = ssbondArray[i+1];
        var chainid1 = resid1.substr(0, resid1.lastIndexOf('_'));
        var chainid2 = resid2.substr(0, resid2.lastIndexOf('_'));
        if(chainid === chainid1) {
            if(resid2resids[resid1] === undefined) resid2resids[resid1] = [];
            resid2resids[resid1].push(resid2);
        }
        if(chainid === chainid2) {
            if(resid2resids[resid2] === undefined) resid2resids[resid2] = [];
            resid2resids[resid2].push(resid1);
        }
    }
    var residueArray = Object.keys(resid2resids);
    var title = "Disulfide Bonds";
    me.showAnnoType(chnid, chnidBase, 'ssbond', title, residueArray, resid2resids);
};
iCn3DUI.prototype.showCrosslink = function(chnid, chnidBase) { var me = this, ic = me.icn3d; "use strict";
    if(ic.clbondpnts === undefined) {
        // didn't finish loading atom data yet
        setTimeout(function(){
          me.showCrosslink_base(chnid, chnidBase);
        }, 1000);
    }
    else {
        me.showCrosslink_base(chnid, chnidBase);
    }
};
iCn3DUI.prototype.showCrosslink_base = function(chnid, chnidBase) { var me = this, ic = me.icn3d; "use strict";
    var chainid = chnidBase;
    var resid2resids = {};
    var structure = chainid.substr(0, chainid.indexOf('_'));
    var clbondArray = ic.clbondpnts[structure];
    if(clbondArray === undefined) {
        $("#" + me.pre + "dt_crosslink_" + chnid).html('');
        $("#" + me.pre + "ov_crosslink_" + chnid).html('');
        $("#" + me.pre + "tt_crosslink_" + chnid).html('');
        return;
    }
    for(var i = 0, il = clbondArray.length; i < il; i = i + 2) {
        var resid1 = clbondArray[i]; // chemical
        var resid2 = clbondArray[i+1]; // protein or chemical
        var chainid1 = resid1.substr(0, resid1.lastIndexOf('_'));
        var chainid2 = resid2.substr(0, resid2.lastIndexOf('_'));
        //if(chainid === chainid1) {
        //    if(resid2resids[resid1] === undefined) resid2resids[resid1] = [];
        //    resid2resids[resid1].push(resid2);
        //}
        if(chainid === chainid2) {
            if(resid2resids[resid2] === undefined) resid2resids[resid2] = [];
            resid2resids[resid2].push(resid1);
        }
    }
    var residueArray = Object.keys(resid2resids);
    var title = "Cross-Linkages";
    me.showAnnoType(chnid, chnidBase, 'crosslink', title, residueArray, resid2resids);
};
iCn3DUI.prototype.showTransmem = function(chnid, chnidBase) { var me = this, ic = me.icn3d; "use strict";
    if(ic.ssbondpnts === undefined) {
        // didn't finish loading atom data yet
        setTimeout(function(){
          me.showTransmem_base(chnid, chnidBase);
        }, 1000);
    }
    else {
        me.showTransmem_base(chnid, chnidBase);
    }
};
iCn3DUI.prototype.showTransmem_base = function(chnid, chnidBase) { var me = this, ic = me.icn3d; "use strict";
    var residHash = {};
    for(var serial in ic.chains[chnidBase]) {
        var atom = ic.atoms[serial];
        if(atom.coord.z < ic.halfBilayerSize && atom.coord.z > -ic.halfBilayerSize) {
            var resid = atom.structure + '_' + atom.chain + '_' + atom.resi;
            residHash[resid] = 1;
        }
    }
    var residueArray = Object.keys(residHash);
    var title = "Transmembrane domain";
    me.showAnnoType(chnid, chnidBase, 'transmem', title, residueArray);
};
iCn3DUI.prototype.showAnnoType = function(chnid, chnidBase, type, title, residueArray, resid2resids) { var me = this, ic = me.icn3d; "use strict";
    var html = '<div id="' + me.pre + chnid + '_' + type + 'seq_sequence" class="icn3d-dl_sequence">';
    var html2 = html;
    var html3 = html;
    if(residueArray.length == 0) {
        $("#" + me.pre + "dt_" + type + "_" + chnid).html('');
        $("#" + me.pre + "ov_" + type + "_" + chnid).html('');
        $("#" + me.pre + "tt_" + type + "_" + chnid).html('');
        return;
    }
    var fulltitle = title;
    if(title.length > 17) title = title.substr(0, 17) + '...';
    var resPosArray = [];
    for(var i = 0, il = residueArray.length; i < il; ++i) {
        var resid = residueArray[i];
        var resi = Math.round(resid.substr(residueArray[i].lastIndexOf('_') + 1) );
        resPosArray.push( resi );
    }
    var resCnt = resPosArray.length;
    var chainnameNospace = type;
    var htmlTmp2 = '<div class="icn3d-seqTitle icn3d-link icn3d-blue" ' + type + '="" posarray="' + resPosArray.toString() + '" shorttitle="' + title + '" setname="' + chnid + '_' + chainnameNospace + '" anno="sequence" chain="' + chnid + '" title="' + fulltitle + '">' + title + ' </div>';
    var htmlTmp3 = '<span class="icn3d-residueNum" title="residue count">' + resCnt.toString() + ' Res</span>';
    html3 += htmlTmp2 + htmlTmp3 + '<br>';
    var htmlTmp = '<span class="icn3d-seqLine">';
    html += htmlTmp2 + htmlTmp3 + htmlTmp;
    html2 += htmlTmp2 + htmlTmp3 + htmlTmp;
    var pre = type;
    var prevEmptyWidth = 0;
    var prevLineWidth = 0;
    var widthPerRes = 1;
    for(var i = 0, il = me.giSeq[chnid].length; i < il; ++i) {
      html += me.insertGap(chnid, i, '-');
      if(resPosArray.indexOf(i+1 + me.baseResi[chnid]) != -1) {
          var cFull = me.giSeq[chnid][i];
          var c = cFull;
          if(cFull.length > 1) {
              c = cFull[0] + '..';
          }
          var pos = (i >= me.matchedPos[chnid] && i - me.matchedPos[chnid] < ic.chainsSeq[chnid].length) ? ic.chainsSeq[chnid][i - me.matchedPos[chnid]].resi : me.baseResi[chnid] + 1 + i;
          var resid = chnid + '_' + (i+1 + me.baseResi[chnid]).toString();
          var title = cFull + (i+1 + me.baseResi[chnid]).toString();
          if(type == 'ssbond') {
              title = 'Residue ' + resid + ' has disulfide bond with';
              if(resid2resids[resid] !== undefined) {
                  for(var j = 0, jl = resid2resids[resid].length; j < jl; ++j) {
                      title += ' residue ' + resid2resids[resid][j];
                  }
              }
          }
          else if(type == 'crosslink') {
              title = 'Residue ' + resid + ' has cross-linkage with';
              if(resid2resids[resid] !== undefined) {
                  for(var j = 0, jl = resid2resids[resid].length; j < jl; ++j) {
                      title += ' residue ' + resid2resids[resid][j];
                  }
              }
          }
          html += '<span id="' + pre + '_' + me.pre + chnid + '_' + pos + '" title="' + title + '" class="icn3d-residue">' + c + '</span>';
          html2 += me.insertGapOverview(chnid, i);
          var emptyWidth = (me.cfg.blast_rep_id == chnid) ? Math.round(me.seqAnnWidth * i / (me.maxAnnoLength + me.nTotalGap) - prevEmptyWidth - prevLineWidth) : Math.round(me.seqAnnWidth * i / me.maxAnnoLength - prevEmptyWidth - prevLineWidth);
            //if(emptyWidth < 0) emptyWidth = 0;
            if(emptyWidth >= 0) {
            html2 += '<div style="display:inline-block; width:' + emptyWidth + 'px;">&nbsp;</div>';
            html2 += '<div style="display:inline-block; background-color:#000; width:' + widthPerRes + 'px;" title="' + title + '">&nbsp;</div>';
            prevEmptyWidth += emptyWidth;
            prevLineWidth += widthPerRes;
            }
      }
      else {
        html += '<span>-</span>'; //'<span>-</span>';
      }
    }
    htmlTmp = '<span class="icn3d-residueNum" title="residue count">&nbsp;' + resCnt.toString() + ' Residues</span>';
    htmlTmp += '</span>';
    htmlTmp += '<br>';
    html += htmlTmp;
    html2 += htmlTmp;
    html += '</div>';
    html2 += '</div>';
    html3 += '</div>';
    $("#" + me.pre + "dt_" + type + "_" + chnid).html(html);
    $("#" + me.pre + "ov_" + type + "_" + chnid).html(html2);
    $("#" + me.pre + "tt_" + type + "_" + chnid).html(html3);
};
iCn3DUI.prototype.hideAllAnno = function() { var me = this, ic = me.icn3d; "use strict";
        me.hideAllAnnoBase();
        $("[id^=" + me.pre + "custom]").hide();
};
iCn3DUI.prototype.hideAllAnnoBase = function() { var me = this, ic = me.icn3d; "use strict";
    me.setAnnoSeqBase(false);
};
iCn3DUI.prototype.setAnnoSeqBase = function (bShow) {  var me = this, ic = me.icn3d; "use strict";
    var itemArray = ['site', 'snp', 'clinvar', 'cdd', 'domain', 'interaction', 'ssbond', 'crosslink', 'transmem'];
    for(var i in itemArray) {
        var item = itemArray[i];
        if(bShow) {
            $("[id^=" + me.pre + item + "]").show();
        }
        else {
            $("[id^=" + me.pre + item + "]").hide();
        }
    }
};
iCn3DUI.prototype.setAnnoTabBase = function (bChecked) {  var me = this, ic = me.icn3d; "use strict";
    var itemArray = ['all', 'binding', 'snp', 'clinvar', 'cdd', '3dd', 'interact', 'custom', 'ssbond', 'crosslink', 'transmem'];
    for(var i in itemArray) {
        var item = itemArray[i];
        if($("#" + me.pre + "anno_" + item).length) $("#" + me.pre + "anno_" + item)[0].checked = bChecked;
    }
};
iCn3DUI.prototype.setAnnoTabAll = function () {  var me = this, ic = me.icn3d; "use strict";
    me.setAnnoTabBase(true);
    me.setAnnoSeqBase(true);
    me.updateClinvar();
    me.updateSnp();
    me.updateDomain();
    me.updateInteraction();
    me.updateSsbond();
    me.updateCrosslink();
    me.updateTransmem();
};
iCn3DUI.prototype.hideAnnoTabAll = function () {  var me = this, ic = me.icn3d; "use strict";
    me.setAnnoTabBase(false);
    me.hideAllAnno();
};
iCn3DUI.prototype.resetAnnoTabAll = function () {  var me = this, ic = me.icn3d; "use strict";
    if($("#" + me.pre + "anno_binding").length && $("#" + me.pre + "anno_binding")[0].checked) {
        $("[id^=" + me.pre + "site]").show();
    }
    if($("#" + me.pre + "anno_snp").length && $("#" + me.pre + "anno_snp")[0].checked) {
        $("[id^=" + me.pre + "snp]").show();
        me.bSnpShown = false;
        me.updateSnp();
    }
    if($("#" + me.pre + "anno_clinvar").length && $("#" + me.pre + "anno_clinvar")[0].checked) {
        $("[id^=" + me.pre + "clinvar]").show();
        me.bClinvarShown = false;
        me.updateClinvar();
    }
    if($("#" + me.pre + "anno_cdd").length && $("#" + me.pre + "anno_cdd")[0].checked) {
        $("[id^=" + me.pre + "cdd]").show();
    }
    if($("#" + me.pre + "anno_3dd").length && $("#" + me.pre + "anno_3dd")[0].checked) {
        $("[id^=" + me.pre + "domain]").show();
        me.bDomainShown = false;
        me.updateDomain();
    }
    if($("#" + me.pre + "anno_interact").length && $("#" + me.pre + "anno_interact")[0].checked) {
        $("[id^=" + me.pre + "interaction]").show();
        me.bInteractionShown = false;
        me.updateInteraction();
    }
    if($("#" + me.pre + "anno_custom").length && $("#" + me.pre + "anno_custom")[0].checked) {
        $("[id^=" + me.pre + "custom]").show();
    }
    if($("#" + me.pre + "anno_ssbond").length && $("#" + me.pre + "anno_ssbond")[0].checked) {
        $("[id^=" + me.pre + "ssbond]").show();
        me.bSSbondShown = false;
        me.updateSsbond();
    }
    if($("#" + me.pre + "anno_crosslink").length && $("#" + me.pre + "anno_crosslink")[0].checked) {
        $("[id^=" + me.pre + "crosslink]").show();
        me.bCrosslinkShown = false;
        me.updateCrosslink();
    }
    if($("#" + me.pre + "anno_transmem").length && $("#" + me.pre + "anno_transmem")[0].checked) {
        $("[id^=" + me.pre + "transmem]").show();
        me.bTranememShown = false;
        me.updateTransmem();
    }
};
iCn3DUI.prototype.setAnnoTabCustom = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "custom]").show();
    if($("#" + me.pre + "anno_custom").length) $("#" + me.pre + "anno_custom")[0].checked = true;
};
iCn3DUI.prototype.hideAnnoTabCustom = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "custom]").hide();
    if($("#" + me.pre + "anno_custom").length) $("#" + me.pre + "anno_custom")[0].checked = false;
};
iCn3DUI.prototype.setAnnoTabClinvar = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "clinvar]").show();
    if($("#" + me.pre + "anno_clinvar").length) $("#" + me.pre + "anno_clinvar")[0].checked = true;
    me.updateClinvar();
};
iCn3DUI.prototype.hideAnnoTabClinvar = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "clinvar]").hide();
    if($("#" + me.pre + "anno_clinvar").length) $("#" + me.pre + "anno_clinvar")[0].checked = false;
};
iCn3DUI.prototype.setAnnoTabSnp = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "snp]").show();
    if($("#" + me.pre + "anno_snp").length) $("#" + me.pre + "anno_snp")[0].checked = true;
    me.updateSnp();
};
iCn3DUI.prototype.hideAnnoTabSnp = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "snp]").hide();
    if($("#" + me.pre + "anno_snp").length) $("#" + me.pre + "anno_snp")[0].checked = false;
};
iCn3DUI.prototype.setAnnoTabCdd = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "cdd]").show();
    if($("#" + me.pre + "anno_cdd").length) $("#" + me.pre + "anno_cdd")[0].checked = true;
};
iCn3DUI.prototype.hideAnnoTabCdd = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "cdd]").hide();
    if($("#" + me.pre + "anno_cdd").length) $("#" + me.pre + "anno_cdd")[0].checked = false;
};
iCn3DUI.prototype.setAnnoTab3ddomain = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "domain]").show();
    if($("#" + me.pre + "anno_3dd").length) $("#" + me.pre + "anno_3dd")[0].checked = true;
    me.updateDomain();
};
iCn3DUI.prototype.hideAnnoTab3ddomain = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "domain]").hide();
    if($("#" + me.pre + "anno_3dd").length) $("#" + me.pre + "anno_3dd")[0].checked = false;
};
iCn3DUI.prototype.setAnnoTabSite = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "site]").show();
    if($("#" + me.pre + "anno_binding").length) $("#" + me.pre + "anno_binding")[0].checked = true;
};
iCn3DUI.prototype.hideAnnoTabSite = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "site]").hide();
    if($("#" + me.pre + "anno_binding").length) $("#" + me.pre + "anno_binding")[0].checked = false;
};
iCn3DUI.prototype.setAnnoTabInteraction = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "interaction]").show();
    if($("#" + me.pre + "anno_interact").length) $("#" + me.pre + "anno_interact")[0].checked = true;
    me.updateInteraction();
};
iCn3DUI.prototype.hideAnnoTabInteraction = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "interaction]").hide();
    if($("#" + me.pre + "anno_interact").length) $("#" + me.pre + "anno_interact")[0].checked = false;
};
iCn3DUI.prototype.setAnnoTabSsbond = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "ssbond]").show();
    if($("#" + me.pre + "anno_ssbond").length) $("#" + me.pre + "anno_ssbond")[0].checked = true;
    me.updateSsbond();
};
iCn3DUI.prototype.hideAnnoTabSsbond = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "ssbond]").hide();
    if($("#" + me.pre + "anno_ssbond").length) $("#" + me.pre + "anno_ssbond")[0].checked = false;
};
iCn3DUI.prototype.setAnnoTabCrosslink = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "crosslink]").show();
    if($("#" + me.pre + "anno_crosslink").length) $("#" + me.pre + "anno_crosslink")[0].checked = true;
    me.updateCrosslink();
};
iCn3DUI.prototype.hideAnnoTabCrosslink = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "crosslink]").hide();
    if($("#" + me.pre + "anno_crosslink").length) $("#" + me.pre + "anno_crosslink")[0].checked = false;
};
iCn3DUI.prototype.setAnnoTabTransmem = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "transmem]").show();
    if($("#" + me.pre + "anno_transmem").length) $("#" + me.pre + "anno_transmem")[0].checked = true;
    me.updateTransmem();
};
iCn3DUI.prototype.hideAnnoTabTransmem = function () {  var me = this, ic = me.icn3d; "use strict";
    $("[id^=" + me.pre + "transmem]").hide();
    if($("#" + me.pre + "anno_transmem").length) $("#" + me.pre + "anno_transmem")[0].checked = false;
};
iCn3DUI.prototype.setTabs = function () {  var me = this, ic = me.icn3d; "use strict";
//        $("#" + me.pre + "dl_annotations_tabs").tabs();
    $("#" + me.pre + "dl_addtrack_tabs").tabs();
    $("#" + me.pre + "dl_anno_view_tabs").tabs();
    $("#" + me.pre + "anno_all").click(function (e) {
    if($("#" + me.pre + "anno_all")[0].checked) {
        me.setAnnoTabAll();
        me.setLogCmd("set annotation all", true);
    }
    else{
        me.hideAnnoTabAll();
        me.setLogCmd("hide annotation all", true);
    }
    });
    $("#" + me.pre + "anno_binding").click(function (e) {
    if($("#" + me.pre + "anno_binding")[0].checked) {
        me.setAnnoTabSite();
        me.setLogCmd("set annotation site", true);
    }
    else{
        me.hideAnnoTabSite();
        me.setLogCmd("hide annotation site", true);
    }
    });
    $("#" + me.pre + "anno_snp").click(function (e) {
    if($("#" + me.pre + "anno_snp")[0].checked) {
        me.setAnnoTabSnp();
        me.setLogCmd("set annotation snp", true);
    }
    else{
        me.hideAnnoTabSnp();
        me.setLogCmd("hide annotation snp", true);
    }
    });
    $("#" + me.pre + "anno_clinvar").click(function (e) {
    if($("#" + me.pre + "anno_clinvar")[0].checked) {
        me.setAnnoTabClinvar();
        me.setLogCmd("set annotation clinvar", true);
    }
    else{
        me.hideAnnoTabClinvar();
        me.setLogCmd("hide annotation clinvar", true);
    }
    });
    $("#" + me.pre + "anno_cdd").click(function (e) {
        me.clickCdd();
    });
    $("#" + me.pre + "anno_3dd").click(function (e) {
    if($("#" + me.pre + "anno_3dd")[0].checked) {
        me.setAnnoTab3ddomain();
        me.setLogCmd("set annotation 3ddomain", true);
    }
    else{
        me.hideAnnoTab3ddomain();
        me.setLogCmd("hide annotation 3ddomain", true);
    }
    });
    $("#" + me.pre + "anno_interact").click(function (e) {
    if($("#" + me.pre + "anno_interact")[0].checked) {
        me.setAnnoTabInteraction();
        me.setLogCmd("set annotation interaction", true);
    }
    else{
        me.hideAnnoTabInteraction();
        me.setLogCmd("hide annotation interaction", true);
    }
    });
    $("#" + me.pre + "anno_custom").click(function (e) {
    if($("#" + me.pre + "anno_custom")[0].checked) {
        me.setAnnoTabCustom();
        me.setLogCmd("set annotation custom", true);
    }
    else{
        me.hideAnnoTabCustom();
        me.setLogCmd("hide annotation custom", true);
    }
    });
    $("#" + me.pre + "anno_ssbond").click(function (e) {
    if($("#" + me.pre + "anno_ssbond")[0].checked) {
        me.setAnnoTabSsbond();
        me.setLogCmd("set annotation ssbond", true);
    }
    else{
        me.hideAnnoTabSsbond();
        me.setLogCmd("hide annotation ssbond", true);
    }
    });
    $("#" + me.pre + "anno_crosslink").click(function (e) {
    if($("#" + me.pre + "anno_crosslink")[0].checked) {
        me.setAnnoTabCrosslink();
        me.setLogCmd("set annotation crosslink", true);
    }
    else{
        me.hideAnnoTabCrosslink();
        me.setLogCmd("hide annotation crosslink", true);
    }
    });
    $("#" + me.pre + "anno_transmem").click(function (e) {
    if($("#" + me.pre + "anno_transmem").length && $("#" + me.pre + "anno_transmem")[0].checked) {
        me.setAnnoTabTransmem();
        me.setLogCmd("set annotation transmembrane", true);
    }
    else{
        me.hideAnnoTabTransmem();
        me.setLogCmd("hide annotation transmembrane", true);
    }
    });
};
iCn3DUI.prototype.clickCdd = function() { var me = this, ic = me.icn3d; "use strict";
  if($("[id^=" + me.pre + "cdd]").length > 0) {
    if($("#" + me.pre + "anno_cdd")[0].checked) {
        me.setAnnoTabCdd();
        me.setLogCmd("set annotation cdd", true);
    }
    else{
        me.hideAnnoTabCdd();
        me.setLogCmd("hide annotation cdd", true);
    }
  }
};
// jquery tooltip
//https://stackoverflow.com/questions/18231315/jquery-ui-tooltip-html-with-links
iCn3DUI.prototype.setToolTip = function () {  var me = this, ic = me.icn3d; "use strict";
  $("[id^=" + me.pre + "snp]").add("[id^=" + me.pre + "clinvar]").add("[id^=" + me.pre + "ssbond]").add("[id^=" + me.pre + "crosslink]").tooltip({
    content: function () {
        return $(this).prop('title');
    },
    show: null,
    close: function (event, ui) {
        ui.tooltip.hover(
        function () {
            $(this).stop(true).fadeTo(400, 1);
        },
        function () {
            $(this).fadeOut("400", function () {
                $(this).remove();
            })
        });
    }
  });
};
iCn3DUI.prototype.showAnnoSelectedChains = function () {   var me = this, ic = me.icn3d; "use strict";
    // show selected chains in annotation window
    var chainHash = {};
    for(var i in ic.hAtoms) {
        var atom = ic.atoms[i];
        var chainid = atom.structure + '_' + atom.chain;
        chainHash[chainid] = 1;
    }
    $("#" + me.pre + "dl_annotations > .icn3d-annotation").hide();
    for(var chainid in chainHash) {
        if($("#" + me.pre + "anno_" + chainid).length) {
            $("#" + me.pre + "anno_" + chainid).show();
        }
        var atom = ic.getFirstCalphaAtomObj(ic.chains[chainid]);
        if(atom.resn !== undefined) {
            var oneLetterRes = ic.residueName2Abbr(atom.resn.substr(0, 3));
            $("#" + me.pre + "anno_" + oneLetterRes).show();
        }
    }
};
iCn3DUI.prototype.showAnnoAllChains = function () {   var me = this, ic = me.icn3d; "use strict";
    $("#" + me.pre + "dl_annotations > .icn3d-annotation").show();
};
iCn3DUI.prototype.setAnnoView = function(view) { var me = this, ic = me.icn3d; "use strict";
    if(view === 'detailed view') {
        me.view = 'detailed view';
        $( "#" + me.pre + "dl_anno_view_tabs" ).tabs( "option", "active", 1 );
    }
    else { // overview
        me.view = 'overview';
        $( "#" + me.pre + "dl_anno_view_tabs" ).tabs( "option", "active", 0 );
    }
};
iCn3DUI.prototype.setAnnoDisplay = function(display, prefix) { var me = this, ic = me.icn3d; "use strict";
    var itemArray = ['giseq', 'custom', 'site', 'snp', 'clinvar', 'cdd', 'domain', 'interaction', 'ssbond', 'crosslink', 'transmem'];
    for(var i in itemArray) {
        var item = itemArray[i];
        $("[id^=" + me.pre + prefix + "_" + item + "]").attr('style', display);
    }
};
iCn3DUI.prototype.showFixedTitle = function() { var me = this, ic = me.icn3d; "use strict";
        var style = 'display:block;'
        me.setAnnoDisplay(style, 'tt');
};
iCn3DUI.prototype.hideFixedTitle = function() { var me = this, ic = me.icn3d; "use strict";
        var style = 'display:none!important;'
        me.setAnnoDisplay(style, 'tt');
};
iCn3DUI.prototype.setAnnoViewAndDisplay = function(view) { var me = this, ic = me.icn3d; "use strict";
    if(view === 'detailed view') {
        me.setAnnoView('detailed view');
        var style = 'display:block;'
        me.setAnnoDisplay(style, 'dt');
        $("#" + me.pre + "seqguide_wrapper").attr('style', style);
        style = 'display:none;'
        me.setAnnoDisplay(style, 'ov');
    }
    else { // overview
        me.setAnnoView('overview');
        me.hideFixedTitle();
        var style = 'display:none;'
        me.setAnnoDisplay(style, 'dt');
        $("#" + me.pre + "seqguide_wrapper").attr('style', style);
        style = 'display:block;'
        me.setAnnoDisplay(style, 'ov');
    }
};
