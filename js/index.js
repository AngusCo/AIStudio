document.addEventListener('DOMContentLoaded', function(e) {
            
    // 判斷 setting 給的寬 <640 的話，寬高x2倍，確保產生出的 canvas 不會小於 640，但素材長寬要有兩倍大
    if (setting.mod.width < 640) {
        var resolution = setting.mod.resolution || 2; //找不到 resultion 預設為 2 倍大
        setting.mod.width *= resolution;
        setting.mod.height *= resolution;
    }

    function main() {
        setting.el = '.module-avatar';
        setting.width = setting.mod.width;
        setting.height = setting.mod.height;

        var explosion = new Explosion.Avatar(setting);
        explosion.init();
    }

    Inapp.afterViewable(main);
});