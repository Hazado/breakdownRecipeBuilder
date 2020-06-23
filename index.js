/* global ngapp, xelib, registerPatcher, patcherUrl */

// this patcher doesn't do anything useful, it's just a heavily commented
// example of how to create a UPF patcher.
registerPatcher({
  info: info,
  // array of the game modes your patcher works with
  // see docs://Development/APIs/xelib/Setup for a list of game modes
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
    // default settings for your patcher.  use the patchFileName setting if
    // you want to use a unique patch file for your patcher instead of the
    // default zPatch.esp plugin file.  (using zPatch.esp is recommended)
    defaultSettings: {
      materialPercentage: 0.5,
      enchanted: false,
      daedric: true,
      dragon: true,
      chitin: true,
      bone: true,
      customMaterial: "",
      customMaterialFilter: "",
      customCraftingStations: "",
      patchFileName: 'zPatch.esp'
    }
  },
  // optional array of required filenames.  can omit if empty.
  /*requiredFiles: [],
  getFilesToPatch: function(filenames) {
  // Optional.  You can program strict exclusions here.  These exclusions
  // cannot be overridden by the user.  This function can be removed if you
  // don't want to hard-exclude any files.
  let gameName = xelib.GetGlobal('GameName');
  return filenames.subtract([`${gameName}.esm`]);
  },*/
  execute: (patchFile, helpers, settings, locals) => ({
    initialize: function () {
      // Optional function, omit if empty.
      // Perform anything that needs to be done once at the beginning of the
      // patcher's execution here.  This can be used to cache records which don't
      // need to be patched, but need to be referred to later on.  Store values
      // on the locals variable to refer to them later in the patching process.
      helpers.logMessage(settings.exampleSetting);
      // this line shows you how to load records using the loadRecords helper
      // function and store them on locals for the purpose of caching
      locals.recipes = helpers.loadRecords('COBJ');
    },
    // required: array of process blocks. each process block should have both
    // a load and a patch function.
    process: [{
        load: {
          signature: 'COBJ',
          overrides: true,
          filter: function (record) {
            // return false to filter out (ignore) a particular record

            //Filter out all records that are not made in forges or custom Crafting Station
            let stationRegExp = new RegExp('CraftingSmithingForge|CraftingSmithingSkyforge', 'i');
            if (settings.customCraftingStations != "") {
              stationRegExp = new RegExp('CraftingSmithingForge|CraftingSmithingSkyforge' + '|' + settings.customCraftingStations.replace(',', '|'), 'i');
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

              //Filter out custom materials
              if (settings.customMaterialFilter != "") {
                if (xelib.GetElements(record, 'Items').find(rec => {
                    let item = xelib.GetLinksTo(rec, 'CNTO - Item\\Item');
                    return (xelib.EditorID(item).match(settings.customMaterialFilter.replace(',', '|')) != null)
                  }) != undefined)
                  return false;
              }

              //Filter out items that dont have required item or enough of item
              let itemParse = false;
              xelib.GetElements(record, 'Items').forEach(rec => {
                let item = xelib.GetLinksTo(rec, 'CNTO - Item\\Item');
                let count = xelib.GetValue(rec, 'CNTO - Item\\Count');
                let materialRegExp = new RegExp(settings.customMaterial.replace(',', '|'), 'i');

                if (xelib.EditorID(item).match(/LeatherStrips/i) != null)
                  return;
                else if (xelib.EditorID(item).match(/ingot|scale|bone|chitin|stalhrim|leather/i) != null && (count * settings.materialPercentage) >= 1)
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
          // change values on the record as required
          // you can also remove the record here, but it is discouraged.
          // (try to use filters instead.)
          helpers.logMessage(`Patching ${xelib.LongName(record)}`);
          xelib.SetValue(record, 'COCT', '30');
        }
      }
      /*, {
      // loads all REFRs that place Weapons
      records: filesToPatch => {
      let records = filesToPatch.map(f => {
      return xelib.GetRefrs(f, 'WEAP');
      });
      return Array.prototype.concat.apply([], records);
      },
      // patches REFRs that place weapons to be initially disabled
      patch: function (record) {
      xelib.SetFlag(record, 'Record Header\\Record Flags', 'Initially Disabled', true);
      }
      }*/
    ],
    finalize: function () {}
  })
});
