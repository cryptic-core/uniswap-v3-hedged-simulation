var chart_d = null
var scatter_points = []
var below_zero = []
var below_zero_line = []
var breakevenpoint = 0
var start_lose_money_point = -1
var fee_rate_estimated_1 = 0
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

const chart_opt_with_param = (day,data,breakevenpoint) => {
        
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
            text: `Day ${day}`,
            textStyle:{
                fontSize:20
            }
        },
        xAxis: {
            name:"ETH price",
            type: 'category',
            boundaryGap: false,
            axisLabel: {
                fontSize: '14'
            },
            nameTextStyle:{ 
                fontSize: '21'
            }
        },
        yAxis: {
            name: "PnL(%)",
            type: 'value',
            min:-30,
            max:12,
            boundaryGap: [0, '30%'],
            axisLabel: {
                fontSize: '14'
            },
            nameTextStyle:{ 
                fontSize: '21'
            }
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
                
                markLine: {
                    symbol: ['none', 'none'],
                    label: { formatter: 'Liquidate' },
                    data: below_zero_line,
                    lineStyle: {
                        color: '#E1679C',
                        width: 3
                    },
                },
                lineStyle: {
                    color: '#5470C6',
                    width: 5
                },
                
                areaStyle: {},
                "data": data,
                "label": {
                    "show": false,
                    "position": "top",
                    "margin": 8,
                }
            }
        ],
        graphic:[
            {
                type: 'group',
                left: '14%',
                top: '10%',
                children: [
                  {
                    type: 'rect',
                    z: 100,
                    left: 'center',
                    top: 'middle',
                    shape: {
                      width: 240,
                      height: 90
                    },
                    style: {
                      fill: '#D4D1D6',
                      stroke: '#555',
                      lineWidth: 1,
                      shadowBlur: 8,
                      shadowOffsetX: 3,
                      shadowOffsetY: 3,
                      shadowColor: 'rgba(0,0,0,0.2)'
                    }
                  },
                  {
                    type: 'text',
                    z: 100,
                    left: 'center',
                    top: 'middle',
                    
                    style: {
                      fill: '#333',
                      width: 220,
                      overflow: 'break',
                      text: `fee income:${(fee_rate_estimated_1.toFixed(2))} USD\n\nbreak even price:${breakevenpoint.toFixed(0)}`,
                      font: '20px Microsoft YaHei'
                    }
                  }
                ]
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
    fee_rate_estimated_1 = 0.001915 * cnt / range_perc * mining_usd_amt

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

    breakevenpoint = 0
    start_lose_money_point = -1
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
                fee_rate_estimated_1 = 0.001915 * 90 / range_perc * mining_usd_amt
                // sell put part
                let P = start_price + tick * k * 0.8
                let P_clamp = Math.min( Math.max(P,lower),upper)
                let rawlpc = getILPriceChange(cprice_matic,P_clamp,upper,lower,deltaX,deltaY)
                let _res = rawlpc.newAssetValue
                if(P<upper){
                    _res =rawlpc.Ly2 + rawlpc.Lx2 * P
                }
                _res += fee_rate_estimated_1
                _res += hedge_usd_amt
                
                let PnL = (_res-initCapital)/initCapital*100

                // buy put part
                let P2 = start_price + tick * k * 1.2
                let P_clamp2 = Math.min( Math.max(P2,lower),upper)
                let rawlpc2 = getILPriceChange(cprice_matic,P_clamp2,upper,lower,deltaX,deltaY)
                let _res2 = rawlpc2.newAssetValue
                if(P2<upper){
                    _res2 =rawlpc2.Ly2 + rawlpc2.Lx2 * P2
                }
                _res2 += fee_rate_estimated_1
                _res2 += hedge_usd_amt
                let PnL2 = -(_res2-initCapital)/initCapital*100*0.668
                // range 11
                if(entry_price<0){
                    if(P2>=cprice_matic){
                        entry_price = k+50
                        breakevenpoint = k+30
                        start_lose_money_point = k
                        lower_idx = k-181
                        upper_idx = k+181
                    }
                }

                let pltval = (PnL+PnL2)*5
                if(false){ // reverse the curve to call 
                    pltval *= -1
                    start_lose_money_point = k+30
                }
                
                scatter_points.push([P.toFixed(0),pltval])
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
                        breakevenpoint = P
                    }
                }
                if(entry_price<0){
                    if(P>=cprice_matic){
                        entry_price = k-1
                    }
                }
                
                let PnL = (_res-initCapital)/initCapital*100
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
                         
                        if(breakevenpoint<0.01){
                            breakevenpoint = P
                            start_lose_money_point = k-1
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

                let PnL = (_res-initCapital)/initCapital * 100
                scatter_points.push([P.toFixed(0),PnL])
            }break;
        }
        
        
    }
    
    
    switch(hedgetype){
        case "noHedge":{
            let callspread = true
            if(callspread){
                below_zero.push(
                    {
                        gt: breakevenpoint-20,
                        lt: upper_idx,
                        color: 'rgba(0, 0, 180, 0.4)'
                    },
                    {
                        gt: upper_idx,
                        lt: num_steps,
                        color: 'rgba(0, 0, 180, 0.08)'
                    },
                )
            }else{
                below_zero.push(
                    {
                        gt: 0,
                        lt: start_lose_money_point,
                        color: 'rgba(0, 0, 180, 0.08)'
                    },
                )
            }

            below_zero_line.push(
                {
                    name: 'entryPrice',
                    xAxis:entry_price,
                    label: { 
                        formatter: 'entryPrice',
                        fontSize: '18'
                    },
                },
                {
                    name: 'lower',
                    xAxis:lower_idx,
                    label: { 
                        formatter: 'lower',
                        fontSize: '18'
                    },
                },
                {
                    name: 'upper',
                    xAxis:upper_idx,
                    label: { 
                        formatter: 'upper',
                        fontSize: '18'
                    },
                }
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
                        fontSize: '18'
                    },
                },
                {
                    name: 'entryPrice',
                    xAxis:entry_price,
                    label: { 
                        formatter: 'entryPrice',
                        fontSize: '18'
                    },
                },
                {
                    name: 'lower',
                    xAxis:lower_idx,
                    label: { 
                        formatter: 'lower',
                        fontSize: '18'
                    },
                },
                {
                    name: 'upper',
                    xAxis:upper_idx,
                    label: { 
                        formatter: 'upper',
                        fontSize: '18'
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
                        fontSize: '18'
                    },
                },
                {
                    name: 'lower',
                    xAxis:lower_idx,
                    label: { 
                        formatter: 'lower',
                        fontSize: '18'
                    },
                },
                {
                    name: 'upper',
                    xAxis:upper_idx,
                    label: { 
                        formatter: 'upper',
                        fontSize: '18'
                    },
                }
            )
        }break;
    }
    
}


const toggleChartData = (cnt,hedgetype="noHedge") => {
    simulate(cnt,hedgetype)
    let opt1 = chart_opt_with_param(cnt,scatter_points,breakevenpoint)
    chart_d.setOption(opt1)
}