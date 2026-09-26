// Scan-filter entry HTML. Relocated verbatim from the `createScanFilterElement`
// closure in `src/ASF-STM.ts`: the profile link it read from the userscript
// scope is now an explicit parameter, like the other template modules.

export function renderScanFilterElement(
  active: boolean,
  appId: string | number,
  gameName: string,
  myProfileLink: string,
): string {
  return `
            <div id="scan-filter-${appId}" class="friendBlock" style="cursor: auto;">
                <div class="playerAvatar ${active ? "ingame" : "offline"}">
                    <a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/${myProfileLink}/gamecards/${appId}/">
                        <img class="stretch" src="https://steamcdn-a.akamaihd.net/steam/apps/${appId}/capsule_184x69.jpg">
                    </a>
                </div>
                <div id="scan-filter-name-${appId}" class="friendBlockContent">${gameName}<br>
                    <input type="checkbox" data-app-id="${appId}" ${active ? "checked" : ""}>
                </div>
            </div>
        `.replaceAll(/(  |\n)/g, "");
}
