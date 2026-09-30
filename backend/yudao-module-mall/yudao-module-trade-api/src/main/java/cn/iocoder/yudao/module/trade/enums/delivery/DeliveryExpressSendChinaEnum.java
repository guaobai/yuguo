package cn.iocoder.yudao.module.trade.enums.delivery;

import cn.hutool.core.util.ArrayUtil;
import cn.iocoder.yudao.framework.common.core.ArrayValuable;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Arrays;

/**
 * 是否国外发货枚举
 *
 * @author jason
 */
@AllArgsConstructor
@Getter
public enum DeliveryExpressSendChinaEnum implements ArrayValuable<Integer> {

    NO(1, "否"),
    YES(2,"是");

    public static final Integer[] ARRAYS = Arrays.stream(values()).map(DeliveryExpressSendChinaEnum::getType).toArray(Integer[]::new);

    /**
     * 类型
     */
    private final Integer type;
    /**
     * 描述
     */
    private final String desc;

    @Override
    public Integer[] array() {
        return ARRAYS;
    }

    public static DeliveryExpressSendChinaEnum valueOf(Integer value) {
        return ArrayUtil.firstMatch(sendChina -> sendChina.getType().equals(value), DeliveryExpressSendChinaEnum.values());
    }

}
