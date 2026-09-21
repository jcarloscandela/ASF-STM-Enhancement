// Per-bot result-row HTML. Converted verbatim from the former
// `src/templates/rowTemplate.js` placeholder: values that used to evaluate in
// the userscript scope are now explicit parameters.

export interface RowTemplateData {
  index: number;
  appIdList: Array<string | number>;
  tradeUrlFull: string;
  botProfileLink: string;
  botAvatarHash: string | null;
  botNickname: string;
  any: string;
  botTotalInventoryCount: number;
  botSteamId: string | number;
  matches: string;
}

export function renderRow(data: RowTemplateData): string {
  return /* HTML */ `
    <div id="asfstmbot_${data.index}" class="badge_row">
      <div class="badge_row_inner">
        <div class="badge_title_row guide_showcase_contributors">
          <div class="badge_title_stats">
            <a class="filter_all" target="_blank" rel="noopener noreferrer" style="margin-right: 1em">
              <div class="btn_darkblue_white_innerfade btn_medium" data-appids="${data.appIdList.join()}">
                <span data-appids="${data.appIdList.join()}">Filter All</span>
              </div>
            </a>
            <a class="full_trade_url" href="${data.tradeUrlFull}" target="_blank" rel="noopener noreferrer">
              <div class="btn_darkblue_white_innerfade btn_medium">
                <span>Offer a trade for all</span>
              </div>
            </a>
          </div>
          <div style="float: left;" class="">
            <div class="user_avatar playerAvatar online">
              <a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/${data.botProfileLink}">
                <img
                  src="https://avatars.cloudflare.steamstatic.com/${data.botAvatarHash === null ? "fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb" : data.botAvatarHash}.jpg"
                />
              </a>
            </div>
          </div>
          <div class="badge_title">
            &nbsp;<a target="_blank" rel="noopener noreferrer" href="https://steamcommunity.com/${data.botProfileLink}"
              >${data.botNickname}</a
            >${data.any} &ensp;<span style="color: #8F98A0;">(${data.botTotalInventoryCount} items)</span> &ensp;<a
              id="blacklist_${data.botSteamId}"
              data-tooltip-text="Blacklist this bot"
              class="tooltip hover_tooltip"
            >
              <img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconForumBan.png?v=1" />
            </a>
          </div>
        </div>
        <div class="badge_title_rule"></div>
        ${data.matches}
      </div>
    </div>
  `;
}
