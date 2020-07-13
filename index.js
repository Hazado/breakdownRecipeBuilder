/* global ngapp, xelib, registerPatcher, patcherUrl */

registerPatcher({
  info: info,
  gameModes: [xelib.gmTES5, xelib.gmSSE],
  settings: {
    // The label is what gets displayed as the settings tab's label
    label: 'Breakdown Recipe Builder',
    // if you set hide to true the settings tab will not be displayed
    //hide: true,
    templateUrl: `${patcherUrl}/partials/settings.html`,
    // controller function for your patcher's settings tab.
    // this is where you put any extra data binding/functions that you
    // need to access through angular on the settings tab.
    controller: function ($scope) {
      let patcherSettings = $scope.settings.breakdownRecipeBuilder;

      // function defined on the scope, gets called when the user
      // clicks the Show Message button via ng-click="showMessage()"
      $scope.showMessage = function () {
        alert(patcherSettings.exampleSetting);
      };
    },
    defaultSettings: {
      materialPercentage: 0.5,
      enchanted: false,
      daedric: true,
      dragon: true,
      chitin: true,
      bone: true,
      hideRecipe: true,
      multiRecipes: true,
      usePerk: false,
      customMaterial: "",
      customMaterialFilter: "",
      customCraftingStations: "",
      ignoreCNAM: "LeatherStrips"
    }
  },
  execute: (patchFile, helpers, settings, locals) => ({
    process: [{
        load: {
          signature: 'COBJ',
          overrides: true,
          filter: function (record) {
            // return false to filter out (ignore) a particular record

            //Filter out all records that are not made in forges or custom Crafting Station
            let stationRegExp = new RegExp('CraftingSmithingForge|CraftingSmithingSkyforge|CraftingTanningRack', 'i');
            if (settings.customCraftingStations != "") {
              stationRegExp = new RegExp('CraftingSmithingForge|CraftingSmithingSkyforge|CraftingTanningRack' + '|' + settings.customCraftingStations.replace(',', '|'), 'i');
            }
            if (xelib.GetValue(record, 'BNAM').match(stationRegExp) == null) {
              return false;
            }

            //Filter out records that dont craft anything
            if (!xelib.HasElement(record, 'CNAM')) {
              return false;
            }

            //Filter out enchanted items
            if (settings.enchanted == false) {
              let item = xelib.GetLinksTo(record, 'CNAM');
              if (xelib.HasElement(item, 'EITM')) {
                return false;
              }
            }

            //Filter out records without required items
            if (xelib.HasElement(record, 'Items')) {

              //Filter out Daedric items
              if (settings.daedric == false) {
                if (xelib.GetElements(record, 'Items').find(rec => {
                    let item = xelib.GetLinksTo(rec, 'CNTO - Item\\Item');
                    return (xelib.EditorID(item).match(/DaedraHeart/i) != null)
                  }) != undefined)
                  return false;
              }

              //Filter out dragon items
              if (settings.dragon == false) {
                if (xelib.GetElements(record, 'Items').find(rec => {
                    let item = xelib.GetLinksTo(rec, 'CNTO - Item\\Item');
                    return (xelib.EditorID(item).match(/DragonBone|DragonScales/i) != null)
                  }) != undefined)
                  return false;
              }

              //Filter out chitin items
              if (settings.chitin == false) {
                if (xelib.GetElements(record, 'Items').find(rec => {
                    let item = xelib.GetLinksTo(rec, 'CNTO - Item\\Item');
                    return (xelib.EditorID(item).match(/chitin/i) != null)
                  }) != undefined)
                  return false;
              }

              //Filter out bonemold items
              if (settings.bone == false) {
                if (xelib.GetElements(record, 'Items').find(rec => {
                    let item = xelib.GetLinksTo(rec, 'CNTO - Item\\Item');
                    return (xelib.EditorID(item).match(/BoneMeal/i) != null)
                  }) != undefined)
                  return false;
              }

              //Filter out crafted items
              if (settings.ignoreCNAM != "") {
                if (xelib.GetValue(record, 'CNAM').match(settings.ignoreCNAM.replace(',', '|')) != null)
                  return false;
              }

              //Filter out items that dont have required item or enough of item
              let itemParse = false;
              let materialRegExp = new RegExp(settings.customMaterial.replace(',', '|'), 'i');
              xelib.GetElements(record, 'Items').forEach(rec => {
                let item = xelib.GetLinksTo(rec, 'CNTO - Item\\Item');
                let count = xelib.GetValue(rec, 'CNTO - Item\\Count');

                if (xelib.EditorID(item).match(/LeatherStrips/i) != null)
                  return;
                else if (settings.customMaterialFilter != "" && xelib.EditorID(item).match(settings.customMaterialFilter.replace(',', '|')) != null)
                  return;
                else if (xelib.EditorID(item).match(/ingot|scale|bone|chitin|stalhrim|leather|hide/i) != null && (count * settings.materialPercentage) >= 1)
                  itemParse = true;
                else if (settings.customMaterial != "" && xelib.EditorID(item).match(materialRegExp) != null && (count * settings.materialPercentage) >= 1)
                  itemParse = true;
              })
              if (!itemParse)
                return false;
            } else
              return false;

            return true;
          }
        },
        patch: function (record) {
          helpers.logMessage(`Patching ${xelib.LongName(record)}`);
          let recordNAM1 = 0;
          let recordTopNAM1 = 0;
          let recordCNAM;
          xelib.GetElements(record, 'Items').find(rec => {
            let count = xelib.GetValue(rec, 'CNTO - Item\\Count');
            if (recordTopNAM1 < (count * settings.materialPercentage))
              recordTopNAM1 = (count * settings.materialPercentage);
          });
          xelib.GetElements(record, 'Items').forEach(rec => {
            let recordBreakdown = xelib.GetLinksTo(record, 'CNAM');
            let item = xelib.GetLinksTo(rec, 'CNTO - Item\\Item');
            let count = xelib.GetValue(rec, 'CNTO - Item\\Count');
            if (!xelib.HasElement(patchFile, `Breakdown_${xelib.EditorID(recordBreakdown)}_${xelib.EditorID(item)}`)) {
              let recordBNAM = xelib.GetLinksTo(record, 'BNAM');
              let customCraftingStationsRegExp = new RegExp(settings.customCraftingStations.replace(',', '|'), 'i');
              if ((count * settings.materialPercentage) < recordTopNAM1 && !settings.multiRecipes)
                return false;
              if (xelib.EditorID(item).match(/LeatherStrips/i) != null)
                return false;
              else if (xelib.EditorID(item).match(/ingot|scale|bone|chitin|stalhrim|leather|hide/i) != null && (count * settings.materialPercentage) >= 1) {
                recordCNAM = item;
                recordNAM1 = count * settings.materialPercentage;
              } else if (settings.customMaterial != "" && xelib.EditorID(item).match(materialRegExp) != null && (count * settings.materialPercentage) >= 1) {
                recordCNAM = item;
                recordNAM1 = count * settings.materialPercentage;
              } else {
                return false;
              }
              let breakdownRecord = xelib.AddElement(patchFile, `COBJ\\COBJ`);
              helpers.cacheRecord(breakdownRecord, `Breakdown_${xelib.EditorID(recordBreakdown)}_${xelib.EditorID(item)}`);
              xelib.AddElementValue(breakdownRecord, 'EDID', `Breakdown_${xelib.EditorID(recordBreakdown)}_${xelib.EditorID(item)}`);
              xelib.AddElementValue(breakdownRecord, 'Items\\[0]\\CNTO - Item\\Item', xelib.EditorID(recordBreakdown));
              xelib.AddElementValue(breakdownRecord, 'Items\\[0]\\CNTO - Item\\Count', xelib.GetValue(record, 'NAM1'));
              xelib.AddElementValue(breakdownRecord, 'CNAM', xelib.EditorID(recordCNAM));
              xelib.AddElementValue(breakdownRecord, 'NAM1', Math.floor(recordNAM1).toString());

              //Use Smelter or Tanning Rack
              if (xelib.EditorID(recordCNAM).match(/leather|hide/i) != null) {
                xelib.AddElementValue(breakdownRecord, 'BNAM', '0007866A');
              } else if (xelib.EditorID(recordBNAM).match(customCraftingStationsRegExp) != null) {
                xelib.AddElementValue(breakdownRecord, 'BNAM', xelib.EditorID(recordBNAM));
              } else {
                xelib.AddElementValue(breakdownRecord, 'BNAM', '000A5CCE');
              }

              //Hide recipe unless you have required items
              if (settings.hideRecipe) {
                xelib.AddCondition(breakdownRecord, 'GetItemCount', '11000000', xelib.GetValue(record, 'NAM1').toString(), xelib.EditorID(recordBreakdown));
              }

              //Add perks as condition to have recipes
              if (settings.usePerk) {
                if (xelib.HasElement(recordBreakdown, 'EITM')) {
                  xelib.AddCondition(breakdownRecord, 'HasPerk', '11000000', '1', 'ArcaneBlacksmith')
                }
                if (xelib.GetElements(record, 'Items').find(rec => {
                    let item = xelib.GetLinksTo(rec, 'CNTO - Item\\Item');
                    return (xelib.EditorID(item).match(/DaedraHeart/i) != null)
                  }) != undefined) {
                  xelib.AddCondition(breakdownRecord, 'HasPerk', '11000000', '1', 'DaedricSmithing')
                }
                if (xelib.EditorID(recordCNAM).match(/steel|bonemeal/i) != null) {
                  xelib.AddCondition(breakdownRecord, 'HasPerk', '11000000', '1', 'SteelSmithing')
                } else if (xelib.EditorID(recordCNAM).match(/dwarven/i) != null) {
                  xelib.AddCondition(breakdownRecord, 'HasPerk', '11000000', '1', 'DwarvenSmithing')
                } else if (xelib.EditorID(recordCNAM).match(/moonstone|calcinium/i) != null) {
                  xelib.AddCondition(breakdownRecord, 'HasPerk', '11000000', '1', 'ElvenSmithing')
                } else if (xelib.EditorID(recordCNAM).match(/orichalcum/i) != null) {
                  xelib.AddCondition(breakdownRecord, 'HasPerk', '11000000', '1', 'OrcishSmithing')
                } else if (xelib.EditorID(recordCNAM).match(/malachite/i) != null) {
                  xelib.AddCondition(breakdownRecord, 'HasPerk', '11000000', '1', 'GlassSmithing')
                } else if (xelib.EditorID(recordCNAM).match(/ebony|stalhrim/i) != null) {
                  xelib.AddCondition(breakdownRecord, 'HasPerk', '11000000', '1', 'EbonySmithing')
                } else if (xelib.EditorID(recordCNAM).match(/dragonbone|dragonscales/i) != null) {
                  xelib.AddCondition(breakdownRecord, 'HasPerk', '11000000', '1', 'DragonArmor')
                } else if (xelib.EditorID(recordCNAM).match(/corundum/i) != null) {
                  xelib.AddCondition(breakdownRecord, 'HasPerk', '11000000', '1', 'AdvancedArmors')
                }
              }
            }
          });
        }
      }
    ],
    finalize: function () {}
  })
});
