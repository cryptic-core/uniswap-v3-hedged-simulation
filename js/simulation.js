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
    let Lx2 = amountX + deltaX
    let Ly2 = amountY + deltaY
    let newAssetValue = Lx2 * newPrice + Ly2
    return {newAssetValue,Lx2,Ly2}
}

const chart_opt_with_param = (day,data,hedgetype) => {
        
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
            name:"ETH price",
            type: 'category',
            boundaryGap: false
        },
        yAxis: {
            name: hedgetype==="hteHedge"?"Asset Value":"PnL",
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
    if(!chart_d){
        chart_d = echarts.init(document.getElementById('assetchart'), 'white', {renderer: 'canvas'})
    }
    // do simulate
    let initCapital = 10000
    let cprice_matic = 1200
    let USD_Price = 1
    let hedgeRatio = 0.05 // 做空比率，0.7代表留了30%的上漲空間
    let miningRatio = 0.6 // 拿來做 uniswap LP 比率，增加部位中性程度


    let upper = 1.1
    let lower = 0.81
    let fee_rate = 0.3
    let initTVL = 7.5 * 1000000
    let range_perc = 0 // 預設1%越寬越少推估的

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


    const sliders = document.getElementsByClassName("range__slider")
	for (let i = 0; i < sliders.length; i++){
		let sld = sliders[i]
        const sliderValue = sld.querySelector(".length__title")
        let sliders_txt = sld.getElementsByClassName("length__title")
        let sldtitle = sliders_txt[0].innerText
        if(sldtitle.includes('Upper Percentage') ){
            upper = cprice_matic * (1 + sld.querySelector("input").value*0.01)
            range_perc = sld.querySelector("input").value
        }else if(sldtitle.includes('Lower Percentage') ){
            lower = cprice_matic * (1 - sld.querySelector("input").value*0.01)
        }else if(sldtitle.includes('Short Ratio')){
            hedgeRatio = sld.querySelector("input").value*0.01
        }
    }
    
    
    // check input parameters
    // console.log(`upper ${upper}`);
    // console.log(`lower ${lower}`);
    // console.log(`hedgeRatio ${hedgeRatio}`);
    // console.log(`miningRatio ${miningRatio}`);
    // console.log(`initCapital ${initCapital}`);
    // console.log(`current price ${cprice_matic}`);
    
    scatter_points = []
    below_zero = [] // start below zero price till chart end
    below_zero_line = []

    // 實際拿下去作市的數量
    let mining_usd_amt = initCapital*(1-hedgeRatio)
    let hedge_usd_amt = initCapital - mining_usd_amt
    
    // 預設1%越寬越少推估的
    const fee_rate_estimated_1 = 0.001915 * cnt / range_perc * mining_usd_amt

    let inkd = getTokenAmountsFromDepositAmounts(cprice_matic, lower, upper, cprice_matic, 1, mining_usd_amt)
    let deltaX = inkd.deltaX
    let deltaY = inkd.deltaY

    let tick = 1
    let start_price = lower*0.5
    let end_price = upper * 1.5
    let num_steps = parseInt((end_price-start_price)/tick)
    let tolower = getILPriceChange(cprice_matic,lower,upper,lower,deltaX,deltaY)
    const constant_hte_p = 1000*1000
    let hte_price = constant_hte_p / cprice_matic
    let amt_hte =  hedge_usd_amt/hte_price

    let start_lose_money_point = -1
    let liquidation_point = -1
    let entry_price = -1
    let lower_idx = 0
    let upper_idx = 0
    // hte 專用，n個水平線以下
    let prvdif = 0
    let bzPair = [] // open/close pair
    let hte_below_cap = []
    // end of hte
    
    for(let k = 1;k<num_steps;k++){
        let P = start_price + tick * k
        //當前經過 IL 計算之後部位剩餘顆數
        let P_clamp = Math.min( Math.max(P,lower),upper)
        let rawlpc = getILPriceChange(cprice_matic,P_clamp,upper,lower,deltaX,deltaY)
        let _res = rawlpc.newAssetValue
        if(P<upper){
            _res =rawlpc.Ly2 + rawlpc.Lx2 * P
        }
        _res += fee_rate_estimated_1
        
        
        switch(hedgetype){
            case "noHedge":{
                _res += hedge_usd_amt
                if(start_lose_money_point<0){
                    if(_res>initCapital){
                        start_lose_money_point = k-1
                    }
                }
                let PnL = (_res-initCapital)
                scatter_points.push([P.toFixed(0),PnL])
            }break;
            case "futureHedge":{
                
                let margin = hedge_usd_amt + (cprice_matic - P) * tolower.Lx2
                let bLiqudate = (margin / hedge_usd_amt)<0.33
                if(bLiqudate){
                    margin = 0
                }
                _res += margin

                if(start_lose_money_point<0){
                    if(_res<initCapital){
                        start_lose_money_point = k-1
                    }
                }
                if(entry_price<0){
                    if(P>=cprice_matic){
                        entry_price = k-1
                    }
                }
                
                let PnL = (_res-initCapital)
                if(!bLiqudate){
                    scatter_points.push([P.toFixed(0),PnL])
                }
            }break;
            case "hteHedge":{
                hte_price = constant_hte_p / P
                _res += amt_hte * hte_price
                
                // hte 專用
                let curcapdif = parseFloat(_res-initCapital)
                
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
                if(entry_price<0){
                    if(P>=cprice_matic){
                        entry_price = k-1
                    }
                }
                scatter_points.push([P.toFixed(0),_res])
            }break;
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
    
    
    switch(hedgetype){
        case "noHedge":{
            below_zero.push(
                {
                    gt: 0,
                    lt: start_lose_money_point,
                    color: 'rgba(0, 0, 180, 0.4)'
                },
            )
        }break;
        case "futureHedge":{
            if(liquidation_point<0){
                liquidation_point = num_steps
            }
            below_zero.push(
                
                {
                    gt: start_lose_money_point,
                    lt: upper_idx,
                    color: 'rgba(0, 0, 180, 0.4)'
                },
                {
                    gt: upper_idx,
                    lt: num_steps,
                    color: 'rgba(10, 0, 180, 0.08)'
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
        }break;
        case "hteHedge":{
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
        }break;
    }
    
}


const toggleChartData = (cnt,hedgetype="noHedge") => {
    simulate(cnt,hedgetype)
    let opt1 = chart_opt_with_param(cnt,scatter_points,hedgetype)
    chart_d.setOption(opt1)
}