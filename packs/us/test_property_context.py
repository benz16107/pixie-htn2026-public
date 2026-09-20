import unittest
from property_context import county, number

class GeographicContextTests(unittest.TestCase):
    def sample(self, **updates):
        data = {'STCOFIPS':'00001','COUNTY':'Example','STATE':'Example','BUILDVALUE':2_000_000,'POPULATION':1000,'AREA':20,'HWAV_AFREQ':2.5,'IFLD_EALB':600,'CFLD_EALB':None,'WFIR_EALB':0,'SWND_EALB':40,'HRCN_EALB':None,'ERQK_EALB':12,'NRI_VER':'test'}
        data.update(updates)
        return county(data)

    def test_rates_use_county_building_value(self):
        self.assertEqual(self.sample()['flood'],300)
        self.assertEqual(self.sample()['wind'],20)
        self.assertEqual(self.sample()['density'],50)

    def test_missing_coastal_or_hurricane_does_not_erase_other_hazards(self):
        result=self.sample()
        self.assertIsNone(result['coastal'])
        self.assertIsNone(result['hurricane'])
        self.assertEqual(result['flood'],300)
        self.assertEqual(result['wind'],20)

    def test_unknown_values_are_not_zero(self):
        for sentinel in (None,-999,-9999):
            self.assertIsNone(self.sample(IFLD_EALB=sentinel)['flood'])
            self.assertIsNone(number(sentinel))
        self.assertEqual(self.sample()['wildfire'],0)

    def test_zero_or_missing_denominator_is_unknown(self):
        for denominator in (0,None,-999):
            self.assertIsNone(self.sample(BUILDVALUE=denominator)['flood'])
            self.assertIsNone(self.sample(AREA=denominator)['density'])

    def test_heat_is_frequency_not_loss_rate(self):
        self.assertEqual(self.sample()['heat'],2.5)

if __name__=='__main__': unittest.main()
