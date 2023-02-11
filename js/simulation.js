var chart_d = null
var scatter_points = []
var below_zero = []
var below_zero_line = []

const getTokenAmountsFromDepositAmounts = (P,Pl,Pu,priceUSDX,priceUSDY,targetAmounts)=>{
    
    deltaL = targetAmounts / ((Math.sqrt(P) - Math.sqrt(Pl)) * priceUSDY + 
            (1 / Math.sqrt(P) - 1 / Math.sqrt(Pu)) * priceUSDX)
  
    deltaY = deltaL * (Math.sqrt(P) - Math.sqrt(Pl))
    if (deltaY * priceUSDY < 0)
      deltaY = 0
    if (deltaY * priceUSDY > targetAmounts)
      deltaY = targetAmounts / priceUSDY
  
    deltaX = deltaL * (1 / Math.sqrt(P) - 1 / Math.sqrt(Pu))
    if (deltaX * priceUSDX < 0)
      deltaX = 0;
    if (deltaX * priceUSDX > targetAmounts)
      deltaX = targetAmounts / priceUSDX
    
    return {deltaX,deltaY}
}

const calcLiquidity = (
    cprice,
    upper,
    lower,
    amountX,
    amountY
)=>{
    let liquidity = 0
    if(cprice <= lower){
        liquidity = amountX * (Math.sqrt(upper) * Math.sqrt(lower)) / (Math.sqrt(upper) - Math.sqrt(lower))
    }else if(upper < cprice){
        let Lx = amountX * (Math.sqrt(upper) * Math.sqrt(cprice)) / (Math.sqrt(upper) - Math.sqrt(cprice))
        let Ly = amountY / (Math.sqrt(cprice) - Math.sqrt(lower))
        liquidity = Math.min(Lx,Ly)
    }else{
        liquidity = amountY / (Math.sqrt(upper) - Math.sqrt(lower))
    }
    return liquidity
}

const getILPriceChange = (
    price,
    newPrice,
    upper,
    lower,
    amountX,
    amountY
  )=>{
    let L = calcLiquidity(price,upper,lower,amountX,amountY)
    let deltaP = Math.sqrt(newPrice) - Math.sqrt(price)
    let oneOverDeltaP = 1/(Math.sqrt(newPrice)) - 1/(Math.sqrt(price))
    let deltaX = oneOverDeltaP * L
    let deltaY = deltaP * L
    let Lx2 = Math.max(0,amountX + deltaX) 
    let Ly2 = Math.max(0,amountY + deltaY)
    let newAssetValue = Lx2 * newPrice + Ly2
    return {newAssetValue,Lx2,Ly2}
}

const chart_opt_with_param = (day,data) => {
        
    return {
        "animation": true,
        "animationThreshold": 2000,
        "animationDuration": 1000,
        "animationEasing": "cubicOut",
        "animationDelay": 0,
        "animationDurationUpdate": 300,
        "animationEasingUpdate": "cubicOut",
        "animationDelayUpdate": 0,
        title: {
            text: `Day ${day}`
        },
        xAxis: {
            type: 'category',
            boundaryGap: false
        },
        yAxis: {
            type: 'value',
            boundaryGap: [0, '30%']
        },
        visualMap: {
            type: 'piecewise',
            show: false,
            dimension: 0,
            seriesIndex: 0,
            pieces:below_zero
        },
        "series": [
            {
                type: 'line',
                smooth: 0.6,
                symbol: 'none',
                lineStyle: {
                    color: '#5470C6',
                    width: 5
                },
                markLine: {
                    symbol: ['none', 'none'],
                    label: { formatter: 'Liquidate' },
                    data: below_zero_line
                },
                
                areaStyle: {},
                "data": data,
                "label": {
                    "show": false,
                    "position": "top",
                    "margin": 8
                }
            }
        ],
    
        tooltip: {
            trigger: 'axis'
        },
    }       
}

const simulate = (cnt=0,hedgetype="noHedge") => {
    switch(hedgetype){
        case "noHedge":{
            simulate_normal(cnt)
        }break;
        case "borrowed":{
            simulate_aave_borrowed(cnt)
        }break;
        case "neutral":{
            simulate_aave_neutral(cnt)
        }
    }
}

const simulate_normal = (cnt)=> {
    if(!chart_d){
        chart_d = echarts.init(document.getElementById('assetchart'), 'white', {renderer: 'canvas'})
    }
    // do simulate
    let initCapital = 10000
    let cprice_matic = 0.89
    let USD_Price = 1
    let hedgeRatio = 0.05 // 做空比率，0.7代表留了30%的上漲空間
    let miningRatio = 0.6 // 拿來做 uniswap LP 比率，增加部位中性程度


    let upper = 1.1
    let lower = 0.81
    let fee_rate = 0.3
    let initTVL = 7.5 * 1000000
    let range_perc = 0 // 預設1%越寬越少推估的
    

    const sliders = document.getElementsByClassName("range__slider")
	for (let i = 0; i < sliders.length; i++){
		let sld = sliders[i]
        const sliderValue = sld.querySelector(".length__title")
        let sliders_txt = sld.getElementsByClassName("length__title")
        let sldtitle = sliders_txt[0].innerText
        if(sldtitle.includes('Upper Percentage') ){
            upper = cprice_matic * (1 + sld.querySelector("input").value*0.01)
            range_perc = sld.querySelector("input").value
            lower = cprice_matic * (1 - sld.querySelector("input").value*0.01)
        }else if(sldtitle.includes('Borrow Ratio')){
            hedgeRatio = sld.querySelector("input").value*0.01
        }else if(sldtitle.includes('LP Amount Ratio')){
            miningRatio = sld.querySelector("input").value*0.01
        }
    }
    
    const input_txt = document.getElementsByClassName("inputbox")
    for (let i = 0; i < input_txt.length; i++){
        let inp = input_txt[i]
        let title = inp.getElementsByClassName('field-title')[0].innerText
        if(title.includes('Initial')){
            initCapital = inp.getElementsByClassName('result__viewbox')[0].value
        }else if(title.includes('Current')){
            cprice_matic = inp.getElementsByClassName('result__viewbox')[0].value
        }
    }

    // check input parameters
    // console.log(`upper ${upper}`);
    // console.log(`lower ${lower}`);
    // console.log(`hedgeRatio ${hedgeRatio}`);
    // console.log(`miningRatio ${miningRatio}`);
    // console.log(`initCapital ${initCapital}`);
    // console.log(`initialPrice ${initialPrice}`);
    
    scatter_points = []
    below_zero = [] // start below zero price till chart end
    below_zero_line = []

    let mining_usd_amt = initCapital
    
    // 預設1%越寬越少推估的
    const fee_rate_estimated_1 = 0.001915 * cnt / range_perc * mining_usd_amt

    let inkd = getTokenAmountsFromDepositAmounts(cprice_matic, lower, upper, cprice_matic, 1, mining_usd_amt)
    let deltaX = inkd.deltaX
    let deltaY = inkd.deltaY
    let rawLq = calcLiquidity(cprice_matic,upper,lower,deltaX,deltaY)

    let tick = 0.01
    let start_price = lower*0.5
    let end_price = upper * 1.5
    let num_steps = parseInt((end_price-start_price)/tick)
    
    let start_lose_money_point = -1
    let liquidation_point = -1
    let entry_price = -1

    // 逼近真實上下界計算公式
    let real_upper = (deltaY + rawLq*Math.sqrt(cprice_matic))/rawLq
    real_upper *= real_upper
    let real_lower = rawLq / (deltaX+rawLq/Math.sqrt(cprice_matic))
    real_lower *= real_lower
    for(let k = 1;k<num_steps;k++){
        let P = start_price + tick * k
        //當前經過 IL 計算之後部位剩餘顆數
        let P_clamp = Math.min( Math.max(P,real_lower),real_upper)
        let rawlpc = getILPriceChange(cprice_matic,P_clamp,upper,lower,deltaX,deltaY)
        let newval = rawlpc.Lx2 * P + rawlpc.Ly2
        newval += fee_rate_estimated_1
        
        scatter_points.push([P.toFixed(3),newval])
        
        if(start_lose_money_point<0){
            if(newval>=initCapital){
                start_lose_money_point = k-1
            }
        }

        if(entry_price<0){
            if(P>=cprice_matic){
                entry_price = k-1
            }
        }
        
    }
    console.log(`start_lose_money_point ${start_lose_money_point}`);
    below_zero.push(
        {
            gt: 0,
            lt: start_lose_money_point,
            color: 'rgba(0, 0, 180, 0.4)'
        },
    
    )
    below_zero_line.push(
        {
            name: 'entryPrice',
            xAxis:entry_price,
            label: { 
                formatter: 'entryPrice',
            },
        }
    )
    
}

const simulate_aave_borrowed = (cnt)=>{
    if(!chart_d){
        chart_d = echarts.init(document.getElementById('assetchart'), 'white', {renderer: 'canvas'})
    }
    // do simulate
    let initCapital = 10000
    let cprice_matic = 0.89
    let USD_Price = 1
    let hedgeRatio = 0.05 // 做空比率，0.7代表留了30%的上漲空間
    let miningRatio = 0.6 // 拿來做 uniswap LP 比率，增加部位中性程度


    let upper = 1.1
    let lower = 0.81
    let fee_rate = 0.3
    let initTVL = 7.5 * 1000000
    let range_perc = 0 // 預設1%越寬越少推估的
    

    const sliders = document.getElementsByClassName("range__slider")
	for (let i = 0; i < sliders.length; i++){
		let sld = sliders[i]
        const sliderValue = sld.querySelector(".length__title")
        let sliders_txt = sld.getElementsByClassName("length__title")
        let sldtitle = sliders_txt[0].innerText
        if(sldtitle.includes('Upper Percentage') ){
            upper = cprice_matic * (1 + sld.querySelector("input").value*0.01)
            range_perc = sld.querySelector("input").value
            lower = cprice_matic * (1 - sld.querySelector("input").value*0.01)
        }else if(sldtitle.includes('Borrow Ratio')){
            hedgeRatio = sld.querySelector("input").value*0.01
        }else if(sldtitle.includes('LP Amount Ratio')){
            miningRatio = sld.querySelector("input").value*0.01
        }
    }
    
    
    const input_txt = document.getElementsByClassName("inputbox")
    for (let i = 0; i < input_txt.length; i++){
        let inp = input_txt[i]
        let title = inp.getElementsByClassName('field-title')[0].innerText
        if(title.includes('Initial')){
            initCapital = inp.getElementsByClassName('result__viewbox')[0].value
        }else if(title.includes('Current')){
            cprice_matic = inp.getElementsByClassName('result__viewbox')[0].value
        }
    }

    // check input parameters
    // console.log(`upper ${upper}`);
    // console.log(`lower ${lower}`);
    // console.log(`hedgeRatio ${hedgeRatio}`);
    // console.log(`miningRatio ${miningRatio}`);
    // console.log(`initCapital ${initCapital}`);
    // console.log(`initialPrice ${initialPrice}`);
    
    scatter_points = []
    below_zero = [] // start below zero price till chart end
    below_zero_line = []

    // 一開始借幣數量
    let hedgeUSDAmt = initCapital * hedgeRatio
    // 借來的顆數
    let shortAmt = hedgeUSDAmt/cprice_matic
    // 借來的顆數實際拿下去作市的數量
    let miningAmt = shortAmt*miningRatio
    // 借來的，持幣不參與作市
    let longAmt = shortAmt - miningAmt 
    let mining_usd_amt = miningAmt * cprice_matic
    // AAVE 清算線
    let liquidation_price = hedgeUSDAmt/miningAmt
    
    // 預設1%越寬越少推估的
    const fee_rate_estimated_1 = 0.001915 * cnt / range_perc * miningAmt

    let inkd = getTokenAmountsFromDepositAmounts(cprice_matic, lower, upper, cprice_matic, 1, mining_usd_amt)
    let deltaX = inkd.deltaX
    let deltaY = inkd.deltaY
    let rawLq = calcLiquidity(initialPrice,upper,lower,deltaX,deltaY)

    let tick = 0.01
    let start_price = lower*0.5
    let end_price = liquidation_price * 1.1
    let num_steps = parseInt((end_price-start_price)/tick)
    
    let start_lose_money_point = -1
    let liquidation_point = -1
    let entry_price = -1
    // 逼近真實上下界計算公式
    let real_upper = (deltaY + rawLq*Math.sqrt(cprice_matic))/rawLq
    real_upper *= real_upper
    let real_lower = rawLq / (deltaX+rawLq/Math.sqrt(cprice_matic))
    real_lower *= real_lower
    for(let k = 1;k<num_steps;k++){
        let P = start_price + tick * k
        //當前經過 IL 計算之後部位剩餘顆數
        let P_clamp = Math.min( Math.max(P,real_lower),real_upper)
        let rawlpc = getILPriceChange(cprice_matic,P_clamp,upper,lower,deltaX,deltaY)
        let amt1 = rawlpc.Lx2
        let amt2 = rawlpc.Ly2
        curamt = amt1+amt2/P + longAmt
        let hedged_res = initCapital - (shortAmt - curamt)*P
        hedged_res += fee_rate_estimated_1
        scatter_points.push([P.toFixed(3),hedged_res])
        
        if(start_lose_money_point<0){
            if(hedged_res<=initCapital){
                start_lose_money_point = k-1
            }
        }
        if(liquidation_point<0){
            if(P>=liquidation_price){
                // liquidate
                console.log(`liquidate @${P}`);
                hedged_res = curamt * P
                hedged_res += fee_rate_estimated_1
                liquidation_point = k-1
            }
        }
        if(entry_price<0){
            if(P>=cprice_matic){
                entry_price = k-1
            }
        }
        
    }

    
    below_zero.push(
        {
            gt: liquidation_point,
            lt: num_steps,
            color: 'rgba(255, 0, 0, 0.4)'
        },
        {
            gt: start_lose_money_point,
            lt: liquidation_point,
            color: 'rgba(0, 0, 180, 0.4)'
        },
    
    )
    below_zero_line.push(
        {
            name: 'liquidate',
            xAxis:liquidation_point,
            label: { 
                formatter: 'liquidate',
            },
        },
        {
            name: 'entryPrice',
            xAxis:entry_price,
            label: { 
                formatter: 'entryPrice',
            },
        }
    )
    
}

const simulate_aave_neutral = (cnt)=>{
    if(!chart_d){
        chart_d = echarts.init(document.getElementById('assetchart'), 'white', {renderer: 'canvas'})
    }
    // do simulate
    let initCapital = 10000
    let cprice_matic = 0.89
    let USD_Price = 1
    let hedgeRatio = 0.05 // 做空比率，0.7代表留了30%的上漲空間
    let miningRatio = 0.6 // 拿來做 uniswap LP 比率，增加部位中性程度


    let upper = 1.1
    let lower = 0.81
    let fee_rate = 0.3
    let initTVL = 7.5 * 1000000
    let range_perc = 0 // 預設1%越寬越少推估的
    

    const sliders = document.getElementsByClassName("range__slider")
	for (let i = 0; i < sliders.length; i++){
		let sld = sliders[i]
        const sliderValue = sld.querySelector(".length__title")
        let sliders_txt = sld.getElementsByClassName("length__title")
        let sldtitle = sliders_txt[0].innerText
        if(sldtitle.includes('Upper Percentage') ){
            upper = cprice_matic * (1 + sld.querySelector("input").value*0.01)
            range_perc = sld.querySelector("input").value
            lower = cprice_matic * (1 - sld.querySelector("input").value*0.01)
        }else if(sldtitle.includes('Borrow Ratio')){
            hedgeRatio = sld.querySelector("input").value*0.01
        }else if(sldtitle.includes('LP Amount Ratio')){
            miningRatio = sld.querySelector("input").value*0.01
        }
    }
    
    
    const input_txt = document.getElementsByClassName("inputbox")
    for (let i = 0; i < input_txt.length; i++){
        let inp = input_txt[i]
        let title = inp.getElementsByClassName('field-title')[0].innerText
        if(title.includes('Initial')){
            initCapital = inp.getElementsByClassName('result__viewbox')[0].value
        }else if(title.includes('Current')){
            cprice_matic = inp.getElementsByClassName('result__viewbox')[0].value
        }
    }

    // check input parameters
    // console.log(`upper ${upper}`);
    // console.log(`lower ${lower}`);
    // console.log(`hedgeRatio ${hedgeRatio}`);
    // console.log(`miningRatio ${miningRatio}`);
    // console.log(`initCapital ${initCapital}`);
    // console.log(`initialPrice ${initialPrice}`);
    
    scatter_points = []
    below_zero = [] // start below zero price till chart end
    below_zero_line = []

    // 借幣比率
    let hedgeUSDAmt = initCapital * hedgeRatio
    let inv_usdamt = hedgeUSDAmt * miningRatio
    // 借來的顆數
    let shortAmt = inv_usdamt/cprice_matic
    let shortbuff = hedgeUSDAmt - inv_usdamt
    // 反挖的 LP ratio，會比原本的要少
    let invr = getTokenAmountsFromDepositAmounts(cprice_matic, lower, upper, cprice_matic, 1, inv_usdamt)
    let deltaX_inv = invr.deltaX
    let deltaY_inv = invr.deltaY
    
    console.log(`deltaX_inv ${deltaX_inv} deltaY_inv ${deltaY_inv} shortbuff:${shortbuff}`)



    let longAmt = initCapital - hedgeUSDAmt
    // 正挖的 LP ratio
    let inkd = getTokenAmountsFromDepositAmounts(cprice_matic, lower, upper, cprice_matic, 1, longAmt)
    let deltaX = inkd.deltaX
    let deltaY = inkd.deltaY
    let rawLq = calcLiquidity(cprice_matic,upper,lower,deltaX,deltaY)

    console.log(`deltaX ${deltaX} deltaY ${deltaY}`)
    
    // AAVE 清算線
    let liquidation_price = hedgeUSDAmt/shortAmt

    // 預設1%越寬越少推估的
    const fee_rate_estimated_1 = 0.001915 * cnt / range_perc * inv_usdamt
    const fee_rate_estimated_2 = 0.001915 * cnt / range_perc * longAmt

    

    let tick = 0.01
    let start_price = lower*0.5
    let end_price = liquidation_price * 1.1
    let num_steps = parseInt((end_price-start_price)/tick)
    
    let start_lose_money_point = -1
    let liquidation_point = -1
    let entry_price = -1
    // 逼近真實上下界計算公式
    let real_upper = (deltaY + rawLq*Math.sqrt(cprice_matic))/rawLq
    real_upper *= real_upper
    let real_lower = rawLq / (deltaX+rawLq/Math.sqrt(cprice_matic))
    real_lower *= real_lower
    let lower_idx = 0
    let upper_idx = 0

    // n個水平線以下
    let prvdif = 0
    let bzPair = [] // open/close pair
    let hte_below_cap = []
    // end of hte
    for(let k = 1;k<num_steps;k++){
        let P = start_price + tick * k

        //反挖 -- 當前經過 IL 計算之後部位剩餘顆數
        let P_clamp = Math.min( Math.max(P,real_lower),real_upper)
        let rawlpc_inv = getILPriceChange(cprice_matic,P_clamp,upper,lower,deltaX_inv,deltaY_inv)
        let amt1_inv = rawlpc_inv.Lx2
        let amt2_inv = rawlpc_inv.Ly2
        curamt = amt1_inv+amt2_inv/P //全部換算成顆數還回去
        let hedged_res = hedgeUSDAmt - (shortAmt - curamt)*P
        hedged_res += fee_rate_estimated_1

        //正挖 -- 當前經過 IL 計算之後部位剩餘顆數
        let rawlpc = getILPriceChange(cprice_matic,P_clamp,upper,lower,deltaX,deltaY)
        let amt1 = rawlpc.Lx2
        let amt2 = rawlpc.Ly2
        curusd = amt1 * P + amt2
        curusd += fee_rate_estimated_2

        hedged_res += curusd
        let Pnl = (hedged_res - initCapital)/initCapital*100
        scatter_points.push([P.toFixed(3),Pnl])
        
        
        //#region below zero
        let curcapdif = parseFloat(hedged_res-initCapital)
        if(k==1){
            if(curcapdif<0){
                bzPair.push(k)
            }
        }
        if(k==num_steps-1){
            if(bzPair.length===1){
                bzPair.push(k)
                hte_below_cap.push(bzPair)
            }
        }
        if(curcapdif * prvdif < 0){
            if((prvdif<=0)&&(curcapdif>0)){ //close
                if(bzPair.length===1){
                    bzPair.push(k)
                    hte_below_cap.push(bzPair)
                    bzPair = []
                }
            }else if((prvdif>0)&&(curcapdif<=0)){ // open
                if(bzPair.length===0){
                    bzPair.push(k)
                }
            }
        }
        prvdif = curcapdif
        //#endregion

        if(liquidation_point<0){
            if(P>=liquidation_price){
                // liquidate
                console.log(`liquidate @${P}`);
                liquidation_point = k-1
            }
        }
        if(entry_price<0){
            if(P>=cprice_matic){
                entry_price = k-1
            }
        }
        if(lower_idx<1){
            if(P>=lower){
                lower_idx = k-1
            }
        }
        if(upper_idx<1){
            if(P>=upper){
                upper_idx = k-1
            }
        }
    }

    
    for(let pr of hte_below_cap){
        below_zero.push(
            {
                gt: pr[0],
                lt: pr[1],
                color: 'rgba(0, 0, 180, 0.4)'
            },
        )
    }
    below_zero_line.push(
        {
            name: 'liquidate',
            xAxis:liquidation_point,
            label: { 
                formatter: 'liquidate',
            },
        },
        {
            name: 'entryPrice',
            xAxis:entry_price,
            label: { 
                formatter: 'entryPrice',
            },
        },
        {
            name: 'lower',
            xAxis:lower_idx,
            label: { 
                formatter: 'lower',
            },
        },
        {
            name: 'upper',
            xAxis:upper_idx,
            label: { 
                formatter: 'upper',
            },
        }
    )
    
}

const toggleChartData = (cnt,hedgetype="noHedge") => {
    simulate(cnt,hedgetype)
    console.log(cnt);
    let opt1 = chart_opt_with_param(cnt,scatter_points)
    chart_d.setOption(opt1)
}